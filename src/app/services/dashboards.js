import { API_ENDPOINTS, apiClient } from "./api";
import {
  buildBackendTransactionSearchParams,
  fetchLiveTransactionFeed as fetchLiveFeedFromApi,
  fetchTransactionSearchRaw,
  fetchTransactions,
  fetchTransactionsByInstitution,
} from "./transactions";
import { parseBackendDate, getBackendDateTime } from "../utils/formatters";

const EMPTY_CHARTS = {
  chartData7d: [],
  responseCodes: [],
  successVolumes7d: [],
  failedTop5Codes: [],
  transactionsByChannel: [],
  failureByInstitution: [],
  averageTime: { ne: 0, ft: 0 },
  successFailurePie: [],
  channelPie: [],
};

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function unwrapPayload(value) {
  const parsed = safeJsonParse(value);

  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return parsed;

  for (const key of ["data", "result", "results", "response", "content", "records", "items"]) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      return unwrapPayload(parsed[key]);
    }
  }

  return parsed;
}

function asArray(value) {
  const unwrapped = unwrapPayload(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === "object") {
    const nestedArray = Object.values(unwrapped).find((entry) => Array.isArray(entry));
    if (nestedArray) return nestedArray;
    return [unwrapped];
  }
  return [];
}

function asObject(value) {
  const unwrapped = unwrapPayload(value);
  if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
    return unwrapped;
  }
  const first = asArray(value)[0];
  return first && typeof first === "object" ? first : {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pickNumber(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return toNumber(source[key]);
    }
  }
  return 0;
}

function pickString(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return String(source[key]);
    }
  }
  return "";
}

function formatCompactCurrency(amount) {
  return `₦${amount.toLocaleString("en-NG", {
    maximumFractionDigits: amount >= 1000000 ? 1 : 2,
    minimumFractionDigits: amount >= 1000000 ? 1 : 2,
  })}`;
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatDisplayDate(value) {
  const parsed = parseBackendDate(value);
  if (!parsed) {
    return value == null ? "" : String(value);
  }
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * JDBC / MySQL date-range params: local calendar wall time, no `T`/`Z`.
 * ISO strings can still trigger 500s on some API builds; backend also normalizes, but this keeps URLs predictable.
 */
function formatDashboardRangeDateParam(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Local midnight at the start of the calendar day for `d`. */
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Last second of the calendar day for `d` (matches e.g. `...&endDate=2026-05-04%2023:59:59`). */
function endOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 0);
}

/** Default range for statistics pages that omit an explicit picker (last N calendar days, inclusive). */
export function defaultDashboardDateRange(days = 7) {
  const end = startOfLocalDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, days - 1));
  return { start, end };
}

/** Dashboard auto-refresh interval when the selected range includes today. */
export const DASHBOARD_AUTO_REFRESH_MS = 30_000;

/** Normalize and order a dashboard date range (local calendar days). */
export function normalizeDashboardDateRange(range) {
  const fallback = startOfLocalDay(new Date());
  const rawStart = range?.start instanceof Date ? range.start : range?.start ? new Date(range.start) : fallback;
  const rawEnd = range?.end instanceof Date ? range.end : range?.end ? new Date(range.end) : rawStart;
  let start = startOfLocalDay(rawStart);
  let end = startOfLocalDay(rawEnd);
  if (Number.isNaN(start.getTime())) start = fallback;
  if (Number.isNaN(end.getTime())) end = start;
  if (start.getTime() > end.getTime()) {
    const swap = start;
    start = end;
    end = swap;
  }
  return { start, end };
}

export function formatDashboardRangeLabel(range) {
  const { start, end } = normalizeDashboardDateRange(range);
  if (start.getTime() === end.getTime()) {
    return start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
  const endFmt = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${startFmt} – ${endFmt}`;
}

/** True when the range includes any part of today (local time). */
export function dashboardRangeIncludesToday(range) {
  const { start, end } = normalizeDashboardDateRange(range);
  const today = startOfLocalDay(new Date());
  const todayEnd = endOfLocalDay(new Date());
  return start.getTime() <= todayEnd.getTime() && end.getTime() >= today.getTime();
}

/**
 * Dashboard metrics and charts for a selected date range (defaults to one day).
 * `isCurrent` tells the API to read live vs archive tables when the range includes today.
 */
function buildDateRangeParams(dateOrRange) {
  if (!dateOrRange) return {};

  let start;
  let end;

  if (typeof dateOrRange === "object" && !(dateOrRange instanceof Date) && (dateOrRange.start || dateOrRange.end)) {
    ({ start, end } = normalizeDashboardDateRange(dateOrRange));
    end = endOfLocalDay(end);
    start = startOfLocalDay(start);
  } else {
    const selectedDate = dateOrRange instanceof Date ? dateOrRange : new Date(dateOrRange);
    if (Number.isNaN(selectedDate.getTime())) return {};
    start = startOfLocalDay(selectedDate);
    end = endOfLocalDay(selectedDate);
  }

  return {
    startDate: formatDashboardRangeDateParam(start),
    endDate: formatDashboardRangeDateParam(end),
    isCurrent: dashboardRangeIncludesToday({ start, end }) ? "true" : "false",
  };
}

/** Selected range as `Date` objects for `/transactions/q/search`. */
function getDashboardRangeAsDates(dateOrRange) {
  if (!dateOrRange) return null;
  if (typeof dateOrRange === "object" && !(dateOrRange instanceof Date) && (dateOrRange.start || dateOrRange.end)) {
    const { start, end } = normalizeDashboardDateRange(dateOrRange);
    return { start: startOfLocalDay(start), end: endOfLocalDay(end) };
  }
  const selectedDate = dateOrRange instanceof Date ? dateOrRange : new Date(dateOrRange);
  if (Number.isNaN(selectedDate.getTime())) return null;
  const day = startOfLocalDay(selectedDate);
  return { start: day, end: endOfLocalDay(day) };
}

function transactionDateBucketKey(dateTimeStr) {
  const s = String(dateTimeStr || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function aggregateMetricsFromTransactionRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  let totalAmount = 0;
  let successCount = 0;
  for (const row of rows) {
    totalAmount += toNumber(row.amount);
    if (row.status === "Successful" || String(row.responseCode || "").trim() === "00") successCount += 1;
  }
  const totalTransactions = rows.length;
  const successRate = totalTransactions > 0 ? (successCount / totalTransactions) * 100 : 0;
  return { totalTransactions, totalAmount, successCount, successRate };
}

function aggregateTrendFromTransactionRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const map = new Map();
  for (const row of rows) {
    const k = transactionDateBucketKey(row.dateTime);
    if (!k) continue;
    const cur = map.get(k) || { transactions: 0, amount: 0 };
    cur.transactions += 1;
    cur.amount += toNumber(row.amount);
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, transactions: v.transactions, amount: v.amount }));
}

/** When `/transactions-by-date-only` returns raw txn rows in `data`, bucket them for charts. */
function aggregateTrendFromRawTransactionList(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const k = transactionDateBucketKey(
      pickString(row, [
        "transaction_date_time",
        "transactionDateTime",
        "dateTime",
        "transactiondate",
        "date",
      ]),
    );
    if (!k) continue;
    const cur = map.get(k) || { transactions: 0, amount: 0 };
    cur.transactions += 1;
    cur.amount += pickNumber(row, ["srcAmount", "amount", "destAmount", "transactionAmount"]);
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: formatDisplayDate(`${date}T12:00:00`) || date,
      transactions: v.transactions,
      amount: v.amount,
    }));
}

function aggregateSuccessVolumesFromTransactionRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const map = new Map();
  for (const row of rows) {
    const k = transactionDateBucketKey(row.dateTime);
    if (!k) continue;
    if (row.status !== "Successful" && String(row.responseCode || "").trim() !== "00") continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, volume]) => ({ date, volume }));
}

function shouldFillDashboardMetricsFromTransactions(summary) {
  return summary.totalTransactions === 0 && summary.totalAmount === 0;
}

/** Prefer by-date / search meta whenever present — it includes real successRate aggregates. */
function shouldPreferTransactionMeta(summary, metaAgg) {
  return Boolean(metaAgg && metaAgg.totalTransactions > 0);
}

/**
 * Parse NetworkResponse.meta (`totalRecords`, `totalValue`, `successRate`) from list endpoints.
 */
function extractMetaAggFromPayload(payload) {
  const raw = getRawResponseObject(payload) ?? asObject(payload);
  let m = raw?.meta;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      m = null;
    }
  }
  if (!m || typeof m !== "object") return null;
  const totalRecords = Number(m.totalRecords ?? m.totalTransactions ?? m.total);
  const totalValue = Number(m.totalValue ?? m.totalAmount ?? m.sum);
  const successRate = Number(m.successRate);
  if (!(Number.isFinite(totalRecords) && totalRecords > 0)) return null;
  const sr = Number.isFinite(successRate) ? Math.min(100, Math.max(0, successRate)) : 0;
  return {
    totalTransactions: totalRecords,
    totalAmount: Number.isFinite(totalValue) ? totalValue : 0,
    successRate: sr,
    successCount: Math.round((sr / 100) * totalRecords),
  };
}

function applyMetaAggToSummary(summary, metaAgg) {
  if (!metaAgg || !(metaAgg.totalTransactions > 0)) return summary;
  const totalTransactions = metaAgg.totalTransactions;
  const totalAmount = metaAgg.totalAmount;
  const successRate = Number.isFinite(metaAgg.successRate) ? metaAgg.successRate : 0;
  const successCount =
    Number.isFinite(metaAgg.successCount)
      ? metaAgg.successCount
      : Math.round((successRate / 100) * totalTransactions);
  return {
    ...summary,
    totalTransactions,
    totalAmount,
    successCount,
    successRate,
    metricCards: {
      totalTransactions: String(totalTransactions),
      volume: formatCompactCurrency(totalAmount),
      successRate: formatPercent(successRate),
      successCount,
      pendingDisputes: summary.metricCards?.pendingDisputes ?? String(summary.pendingDisputes || 0),
    },
  };
}

function filterRowsToRange(rows, range) {
  if (!Array.isArray(rows) || !range) return rows || [];
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return rows.filter((r) => {
    const t = getBackendDateTime(r.dateTime);
    return t > 0 && t >= startMs && t <= endMs;
  });
}

function filterRowsToInstitution(rows, scope) {
  if (!Array.isArray(rows) || !scope) return rows || [];
  const code = String(scope).trim();
  if (!code) return rows;
  return rows.filter((r) => {
    const raw = r.raw || {};
    const src = String(raw.srcInstitutioncode ?? raw.source_institution_code ?? "").trim();
    const dst = String(raw.destInstitutioncode ?? raw.destination_institution_code ?? "").trim();
    return src === code || dst === code;
  });
}

function mergeSummaryWithTransactionSearch(summary, metaAgg, rowAgg) {
  const useMeta = shouldPreferTransactionMeta(summary, metaAgg);
  const useRows = !useMeta && rowAgg && rowAgg.totalTransactions > 0 && shouldFillDashboardMetricsFromTransactions(summary);
  if (!useMeta && !useRows) return summary;

  if (useMeta) return applyMetaAggToSummary(summary, metaAgg);

  const agg = rowAgg;
  const totalTransactions = agg.totalTransactions;
  const totalAmount = agg.totalAmount;
  const successCount = agg.successCount;
  const successRate =
    totalTransactions > 0 ? (successCount / totalTransactions) * 100 : 0;

  return {
    ...summary,
    totalTransactions,
    totalAmount,
    successCount,
    successRate,
    metricCards: {
      totalTransactions: String(totalTransactions),
      volume: formatCompactCurrency(totalAmount),
      successRate: formatPercent(successRate),
      successCount,
      pendingDisputes: summary.metricCards.pendingDisputes,
    },
  };
}

function withPagination(params = {}, { page = 1, limit = 100 } = {}) {
  return {
    page: String(page),
    limit: String(limit),
    isCurrent: "true",
    ...params,
  };
}

function getScopedEndpoint(generalEndpoint, institutionEndpointFactory, institutionCode) {
  return institutionCode ? institutionEndpointFactory(institutionCode) : generalEndpoint;
}

/**
 * Dashboard treats empty or `-1` as "all institutions". `-1` is truthy in JS, so callers must normalize
 * before choosing `.../institution/{code}` or `transactions-trend/{code}` (backend does not accept `-1`).
 */
function institutionCodeForDashboardScope(institutionCode) {
  if (institutionCode == null) return "";
  const s = String(institutionCode).trim();
  if (!s || s === "-1") return "";
  return s;
}

/** Parsed API root object without unwrapping `data` (keeps `tnxModel` alongside transaction lists in `data`). */
function getRawResponseObject(payload) {
  if (payload == null || payload === "") return null;
  const parsed = safeJsonParse(payload);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  return null;
}

function normalizeTrendRowsFromTnxSummary(payload) {
  const tnx = getTnxModelFromPayload(payload);
  if (!tnx) return null;
  const rows = asArray(tnx.summary ?? tnx.summaries);
  if (!rows.length) return null;
  return rows
    .map((row, index) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        date: firstDefined(
          pickString(source, ["date", "label", "day", "name", "period"]),
          `Point ${index + 1}`
        ),
        transactions: pickNumber(source, ["transactions", "count", "totalTransactions", "value", "volume"]),
        amount: pickNumber(source, ["amount", "value", "volume", "totalAmount"]),
      };
    })
    .filter((row) => row.date);
}

function normalizeTrendRows(payload) {
  const fromTnx = normalizeTrendRowsFromTnxSummary(payload);
  if (fromTnx?.length) return fromTnx;
  return asArray(payload)
    .map((row, index) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        date: firstDefined(
          pickString(source, ["date", "label", "day", "name", "period"]),
          `Point ${index + 1}`
        ),
        transactions: pickNumber(source, ["transactions", "count", "totalTransactions", "value", "volume"]),
        amount: pickNumber(source, ["amount", "value", "volume", "totalAmount"]),
      };
    })
    .filter((row) => row.date);
}

function normalizeFailedCodes(payload) {
  return getChartRowsFromPayload(payload)
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        code: pickString(source, ["code", "responseCode", "name", "label"]),
        description: pickString(source, ["description", "message", "responseMessage", "codeDescription"]),
        count: pickNumber(source, ["count", "total", "value", "volume"]),
        fill: pickString(source, ["fill", "color"]) || undefined,
      };
    })
    .filter((row) => row.code);
}

function normalizeChannelRows(payload) {
  return getChartRowsFromPayload(payload)
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      const channel = pickString(source, [
        "channelCode",
        "channelName",
        "channel",
        "name",
        "label",
      ]);
      return {
        channel,
        count: pickNumber(source, ["count", "total", "value", "volume"]),
      };
    })
    .filter((row) => row.channel);
}

function normalizeInstitutionRows(payload) {
  const tnx = getTnxModelFromPayload(payload);
  const summaryRows = tnx ? asArray(tnx.summary) : [];
  const sourceRows = summaryRows.length ? summaryRows : asArray(payload);
  return sourceRows
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      const institutionCode = pickString(source, [
        "institutionCode",
        "financialInstitutionCode",
        "code",
        "destination_institution_code",
        "destinationInstitutionCode",
        "source_institution_code",
        "sourceInstitutionCode",
        "institution_code",
      ]);
      const name = pickString(source, [
        "name",
        "institutionName",
        "financialInstitutionName",
        "institution_name",
        "label",
      ]);
      return {
        /** `/top-failing-institutions` only returns the code, so label the bar with it. */
        name: name || institutionCode,
        institutionCode,
        count: pickNumber(source, ["count", "total", "value", "volume"]),
        fill: pickString(source, ["fill", "color"]) || undefined,
      };
    })
    .filter((row) => row.name || row.institutionCode);
}

/** Backend `NetworkResponse` wraps charts in `tnxModel` (inflows/outflows/summary). */
function getTnxModelFromPayload(payload) {
  const root = getRawResponseObject(payload);
  if (!root) return null;
  const tm = root.tnxModel;
  if (tm && typeof tm === "object") return tm;
  const data = root.data;
  if (data && typeof data === "object" && !Array.isArray(data) && data.tnxModel && typeof data.tnxModel === "object") {
    return data.tnxModel;
  }
  return null;
}

/** Chart list endpoints often put rows in `tnxModel.summary` with `data` null. */
function getChartRowsFromPayload(payload) {
  const tnx = getTnxModelFromPayload(payload);
  const fromTnx = asArray(tnx?.summary ?? tnx?.summaries);
  if (fromTnx.length) return fromTnx;
  return asArray(payload);
}

/** Prefer outflows for institution totals; fall back to inflows; tolerate Jackson camelCase. */
function getTnxFlowRowsForTotals(tnx) {
  if (!tnx || typeof tnx !== "object") return [];
  for (const key of ["outflows", "outFlows", "out_flows"]) {
    const arr = asArray(tnx[key]);
    if (arr.length) return arr;
  }
  for (const key of ["inflows", "inFlows", "in_flows"]) {
    const arr = asArray(tnx[key]);
    if (arr.length) return arr;
  }
  return [];
}

/** `GET /transactions-summary` → `tnxModel.outflows` rows: `volume` = txn count, `value` = amount sum per institution. */
function aggregateTransactionSummaryFromTnxModel(summaryPayload) {
  const tnx = getTnxModelFromPayload(summaryPayload);
  if (!tnx) return null;
  const flows = getTnxFlowRowsForTotals(tnx);
  if (!flows.length) return null;
  let totalTransactions = 0;
  let totalAmount = 0;
  for (const row of flows) {
    const s = row && typeof row === "object" ? row : {};
    totalTransactions += pickNumber(s, ["volume", "count"]);
    totalAmount += pickNumber(s, ["value", "amount", "sum"]);
  }
  if (totalTransactions === 0 && totalAmount === 0) return null;
  return { totalTransactions, totalAmount };
}

/** `GET /successful-transaction-count` → `tnxModel.summary` rows: daily `volume` counts. */
function aggregateSuccessCountFromTnxModel(successPayload) {
  const tnx = getTnxModelFromPayload(successPayload);
  if (!tnx) return null;
  const rows = asArray(tnx.summary ?? tnx.summaries);
  if (!rows.length) return null;
  let n = 0;
  for (const row of rows) {
    const s = row && typeof row === "object" ? row : {};
    n += pickNumber(s, ["volume", "count", "successfulTransactions"]);
  }
  return n;
}

function normalizeAverageTime(payload) {
  const root = getRawResponseObject(payload) ?? {};
  const flatNe = pickNumber(root, ["ne", "NE", "nonFinancial", "averageNE", "average_ne"]);
  const flatFt = pickNumber(root, ["ft", "FT", "financial", "averageFT", "average_ft"]);
  if (flatNe > 0 || flatFt > 0) {
    return { ne: flatNe, ft: flatFt };
  }
  const tnx = getTnxModelFromPayload(payload);
  const summary = asArray(tnx?.summary ?? tnx?.summaries);
  const first = summary[0] && typeof summary[0] === "object" ? summary[0] : {};
  const volume = pickNumber(first, ["volume", "count"]);
  const totalDur = pickNumber(first, ["totalduration", "totalDuration", "total_duration"]);
  if (volume > 0 && totalDur >= 0) {
    let secs = totalDur / volume;
    if (secs > 500) secs /= 1000;
    return { ne: 0, ft: secs };
  }
  return { ne: flatNe, ft: flatFt };
}

function normalizeSummary(summaryPayload, successPayload, averagePayload) {
  const summary = getRawResponseObject(summaryPayload) ?? asObject(summaryPayload);
  const success = getRawResponseObject(successPayload) ?? asObject(successPayload);
  const average = normalizeAverageTime(averagePayload);

  const fromTnx = aggregateTransactionSummaryFromTnxModel(summaryPayload);
  let totalTransactions = pickNumber(summary, ["totalTransactions", "transactions", "count", "total", "volume"]);
  let totalAmount = pickNumber(summary, ["totalAmount", "amount", "transactionVolume", "sum"]);
  if (fromTnx) {
    totalTransactions = fromTnx.totalTransactions;
    totalAmount = fromTnx.totalAmount;
  }

  let successCount = pickNumber(success, ["successfulTransactions", "successCount", "count", "total", "value"]);
  const successFromTnx = aggregateSuccessCountFromTnxModel(successPayload);
  if (successFromTnx != null) successCount = successFromTnx;

  const pendingDisputes = pickNumber(summary, ["pendingDisputes", "disputes", "pending", "pendingCount"]);
  const successRate =
    pickNumber(summary, ["successRate", "successfulRate"]) ||
    (totalTransactions > 0 ? (successCount / totalTransactions) * 100 : 0);

  return {
    totalTransactions,
    totalAmount,
    successCount,
    pendingDisputes,
    successRate,
    averageTime: average,
    metricCards: {
      totalTransactions: String(totalTransactions),
      volume: formatCompactCurrency(totalAmount),
      successRate: formatPercent(successRate),
      successCount,
      pendingDisputes: String(pendingDisputes),
    },
  };
}

function normalizeSuccessVolumes(successPayload, trendPayload) {
  const tnx = getTnxModelFromPayload(successPayload);
  const rawRows = firstDefined(tnx?.summary, tnx?.summaries, successPayload);
  const successRows = asArray(rawRows)
    .map((row, index) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        date: firstDefined(
          pickString(source, ["date", "label", "day", "name", "period"]),
          `Point ${index + 1}`
        ),
        volume: pickNumber(source, ["volume", "count", "value", "successfulTransactions", "total"]),
      };
    })
    .filter((row) => row.date);

  if (successRows.length >= 1) {
    return successRows.map((row) => ({
      ...row,
      date: formatDisplayDate(row.date) || row.date,
    }));
  }

  return normalizeTrendRows(trendPayload).map((row) => ({
    date: row.date,
    volume: row.transactions,
  }));
}

function normalizeResponseCodes(codes) {
  return codes.map((row) => ({
    ...row,
    description: row.description || "Unknown",
  }));
}

function buildSuccessFailurePie(summary) {
  const total = Number(summary?.totalTransactions ?? 0);
  const success = Number(summary?.successCount ?? 0);
  if (total <= 0) return [];
  const failed = Math.max(0, total - success);
  if (success === 0 && failed === 0) return [];
  return [
    { name: "Successful", value: success },
    { name: "Failed / Other", value: failed },
  ].filter((row) => row.value > 0);
}

/** Belema brand colors for transaction status pie slices. */
export const STATUS_PIE_COLORS = {
  Successful: "#00411A",
  Pending: "#FFD600",
  Failed: "#E84A25",
};

function normalizeStatusSummaryRows(payload) {
  const tnx = getTnxModelFromPayload(payload);
  const rows = asArray(tnx?.summary ?? payload);
  if (!rows.length) return [];
  return rows
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      const name = pickString(source, ["label", "name"]) || "Unknown";
      const value = pickNumber(source, ["volume", "value", "count"]);
      return { name, value };
    })
    .filter((row) => row.name && row.value > 0);
}

function buildStatusSummaryPie(statusRows, summaryFallback) {
  if (Array.isArray(statusRows) && statusRows.length) {
    return statusRows;
  }
  return buildSuccessFailurePie(summaryFallback);
}

function extractStatusCounts(statusRows, summaryFallback) {
  const counts = { successful: 0, pending: 0, failed: 0 };
  const rows = Array.isArray(statusRows) ? statusRows : [];
  if (rows.length) {
    for (const row of rows) {
      const source = row && typeof row === "object" ? row : {};
      const name = pickString(source, ["label", "name"]).toLowerCase();
      const value = pickNumber(source, ["volume", "value", "count"]);
      if (name.includes("success")) counts.successful = value;
      else if (name.includes("pending")) counts.pending = value;
      else if (name.includes("fail")) counts.failed = value;
    }
    return counts;
  }

  const total = Number(summaryFallback?.totalTransactions ?? 0);
  const success = Number(summaryFallback?.successCount ?? 0);
  counts.successful = success;
  counts.failed = Math.max(0, total - success);
  return counts;
}

function buildChannelPieRows(channelRows) {
  if (!Array.isArray(channelRows) || !channelRows.length) return [];
  return channelRows
    .map((row) => ({ name: row.channel, value: Number(row.count) || 0 }))
    .filter((row) => row.name && row.value > 0);
}

async function fetchOrNull(endpoint, params) {
  try {
    return await apiClient.get(endpoint, params);
  } catch {
    return null;
  }
}

/** Load transactions for dashboard fallbacks — always institution-scoped when `scope` is set. */
async function fetchTransactionsForDashboardFallback(scope, dateParams) {
  const range = getDashboardRangeAsDates(
    dateParams?.endDate ? parseBackendDate(dateParams.endDate) : new Date(),
  );
  const paged = withPagination(
    dateParams?.startDate && dateParams?.endDate
      ? { startDate: dateParams.startDate, endDate: dateParams.endDate }
      : {},
  );

  if (scope) {
    try {
      return await fetchTransactionsByInstitution(scope, paged);
    } catch {
      /* try search below */
    }
  }

  try {
    const { rows } = await fetchTransactionSearchRaw(
      buildBackendTransactionSearchParams({
        userInstitutionCode: scope || "",
        startDate: range?.start,
        endDate: range?.end,
        page: 1,
        limit: 800,
      }),
    );
    return Array.isArray(rows) ? rows : [];
  } catch {
    if (scope) return [];
    const all = await fetchTransactions();
    return filterRowsToInstitution(filterRowsToRange(all, range), scope);
  }
}

function resolveDashboardContext({
  institutionCode,
  date,
  dateRange,
  requireInstitutionScope = false,
} = {}) {
  const scope = institutionCodeForDashboardScope(institutionCode);
  if (requireInstitutionScope && !scope) {
    throw new Error("Institution code is required to load dashboard data.");
  }
  const resolvedRange =
    dateRange ?? (date ? { start: date, end: date } : null) ?? defaultDashboardDateRange();
  const dateParams = buildDateRangeParams(resolvedRange);
  const pagedDateParams = withPagination(dateParams);
  const averageTimeParams = {
    ...dateParams,
    isCurrent: dateParams.isCurrent || "true",
  };

  return {
    scope,
    resolvedRange,
    dateParams,
    pagedDateParams,
    averageTimeParams,
    summaryEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.transactionsSummary,
      API_ENDPOINTS.dashboards.transactionsSummaryByInstitution,
      scope,
    ),
    successEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.successfulTransactionCount,
      API_ENDPOINTS.dashboards.successfulTransactionCountByInstitution,
      scope,
    ),
    byDateOnlyEndpoint: scope
      ? API_ENDPOINTS.dashboards.transactionsByDateOnlyByInstitution(scope)
      : API_ENDPOINTS.dashboards.transactionsByDateOnly,
    channelsEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.transactionsByChannels,
      API_ENDPOINTS.dashboards.transactionsByChannelsByInstitution,
      scope,
    ),
    failedCodesEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.topFailedResponseCodes,
      API_ENDPOINTS.dashboards.topFailedResponseCodesByInstitution,
      scope,
    ),
    failingInstitutionsEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.topFailingInstitutions,
      API_ENDPOINTS.dashboards.topFailingInstitutionsByInstitution,
      scope,
    ),
    averageTimeEndpoint: getScopedEndpoint(
      API_ENDPOINTS.dashboards.ftAverageTime,
      API_ENDPOINTS.dashboards.ftAverageTimeByInstitution,
      scope,
    ),
    cache: {},
  };
}

async function resolveDashboardSummary(ctx) {
  const { scope, dateParams, summaryEndpoint, cache } = ctx;
  const byDateMeta = extractMetaAggFromPayload(cache.byDateOnlyPayload);

  let summary = normalizeSummary(null, null, null);
  if (byDateMeta) {
    summary = applyMetaAggToSummary(summary, byDateMeta);
  } else if (!scope) {
    const summaryPayload = await fetchOrNull(summaryEndpoint, ctx.dateParams);
    summary = normalizeSummary(summaryPayload, null, null);
  }

  if (shouldFillDashboardMetricsFromTransactions(summary)) {
    try {
      const scopedRows = await fetchTransactionsForDashboardFallback(scope, dateParams);
      if (scopedRows.length) {
        const rowAgg = aggregateMetricsFromTransactionRows(scopedRows);
        summary = mergeSummaryWithTransactionSearch(summary, null, rowAgg);
        cache.workingRows = scopedRows;
      }
    } catch {
      /* keep zero metrics */
    }
  }

  cache.summary = summary;
  return summary;
}

function sumStatusSummaryRows(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + (Number(row?.value) || 0), 0);
}

function dashboardHasChartData(data) {
  if (!data || typeof data !== "object") return false;
  return (
    (Array.isArray(data.successVolumes7d) && data.successVolumes7d.length > 0) ||
    (Array.isArray(data.failedTop5Codes) && data.failedTop5Codes.length > 0) ||
    (Array.isArray(data.transactionsByChannel) && data.transactionsByChannel.length > 0) ||
    (Array.isArray(data.failureByInstitution) && data.failureByInstitution.length > 0) ||
    (Array.isArray(data.successFailurePie) && data.successFailurePie.length > 0) ||
    (Array.isArray(data.channelPie) && data.channelPie.length > 0) ||
    (Array.isArray(data.chartData7d) &&
      data.chartData7d.some((row) => Number(row.transactions) > 0 || Number(row.amount) > 0))
  );
}

function buildMetricsPayload(ctx, summary, statusSummaryRows) {
  const { cache } = ctx;
  const chartData7d = normalizeTrendRows(cache.byDateOnlyPayload);
  const statusTotal = sumStatusSummaryRows(statusSummaryRows);
  const hasTransactions =
    Number(summary.totalTransactions) > 0 ||
    (Array.isArray(cache.workingRows) && cache.workingRows.length > 0) ||
    chartData7d.some((row) => Number(row.transactions) > 0 || Number(row.amount) > 0) ||
    statusTotal > 0;

  return {
    hasTransactions,
    metrics: summary.metricCards,
    statusCounts: hasTransactions
      ? extractStatusCounts(statusSummaryRows, summary)
      : { successful: 0, pending: 0, failed: 0 },
    successFailurePie: hasTransactions ? buildStatusSummaryPie(statusSummaryRows, summary) : [],
    rawSummary: summary,
    ...EMPTY_CHARTS,
  };
}

function buildChartsPayload(ctx, summary, statusSummaryRows) {
  const { scope, resolvedRange, cache } = ctx;
  const {
    byDateOnlyPayload,
    channelsPayload,
    failedCodesPayload,
    failingInstitutionsPayload,
    averageTimePayload,
    successPayload,
    workingRows = [],
  } = cache;

  const byDateMeta = extractMetaAggFromPayload(byDateOnlyPayload);
  if (averageTimePayload) {
    summary = {
      ...summary,
      averageTime: normalizeAverageTime(averageTimePayload),
    };
  }

  let chartData7d = normalizeTrendRows(byDateOnlyPayload);
  if (!chartData7d.some((row) => Number(row.transactions) > 0) && workingRows.length) {
    chartData7d = aggregateTrendFromTransactionRows(workingRows);
  }
  if (!chartData7d.some((row) => Number(row.transactions) > 0)) {
    const rawList = getRawResponseObject(byDateOnlyPayload)?.data;
    if (Array.isArray(rawList) && rawList.length > 0) {
      chartData7d = aggregateTrendFromRawTransactionList(rawList);
    }
  }

  const responseCodes = normalizeResponseCodes(normalizeFailedCodes(failedCodesPayload));
  let successVolumes7d = normalizeSuccessVolumes(successPayload, byDateOnlyPayload);
  const successFromTxn = aggregateSuccessVolumesFromTransactionRows(workingRows);
  if ((!successVolumes7d || successVolumes7d.length < 1) && successFromTxn.length >= 1) {
    successVolumes7d = successFromTxn;
  }
  if ((!successVolumes7d || successVolumes7d.length < 1) && byDateMeta?.successCount > 0) {
    const label = resolvedRange ? formatDashboardRangeLabel(resolvedRange) : "Selected range";
    successVolumes7d = [{ date: label, volume: byDateMeta.successCount }];
  }

  const transactionsByChannel = normalizeChannelRows(channelsPayload);
  const failureByInstitution = scope ? [] : normalizeInstitutionRows(failingInstitutionsPayload);
  const chartPayload = {
    chartData7d,
    responseCodes,
    successVolumes7d,
    failedTop5Codes: responseCodes,
    transactionsByChannel,
    failureByInstitution,
    averageTime: summary.averageTime,
    successFailurePie: buildStatusSummaryPie(statusSummaryRows, summary),
    channelPie: buildChannelPieRows(transactionsByChannel),
  };
  const hasChartData = dashboardHasChartData(chartPayload);
  const hasTransactions =
    Number(summary.totalTransactions) > 0 ||
    workingRows.length > 0 ||
    chartData7d.some((row) => Number(row.transactions) > 0 || Number(row.amount) > 0) ||
    sumStatusSummaryRows(statusSummaryRows) > 0 ||
    hasChartData;
  const showData = hasTransactions || hasChartData;

  return {
    hasTransactions,
    chartData7d: showData ? chartData7d : [],
    responseCodes: showData ? responseCodes : [],
    successVolumes7d: showData ? successVolumes7d : [],
    failedTop5Codes: showData ? responseCodes : [],
    transactionsByChannel: showData ? transactionsByChannel : [],
    failureByInstitution: showData ? failureByInstitution : [],
    averageTime: showData ? summary.averageTime : { ne: 0, ft: 0 },
    successFailurePie: showData ? chartPayload.successFailurePie : [],
    channelPie: showData ? chartPayload.channelPie : [],
  };
}

/** Fast path: KPI cards and status counts (2 API calls). */
export async function fetchAccountsDashboardMetrics(options = {}) {
  const ctx = resolveDashboardContext(options);
  const { scope, pagedDateParams, resolvedRange, dateParams } = ctx;

  const [byDateOnlyPayload, statusSummaryRows] = await Promise.all([
    fetchOrNull(ctx.byDateOnlyEndpoint, pagedDateParams),
    fetchStatusSummary({
      institutionCode: scope,
      dateRange: resolvedRange,
      isCurrent: dateParams.isCurrent !== "false",
    }),
  ]);

  ctx.cache.byDateOnlyPayload = byDateOnlyPayload;
  ctx.cache.statusSummaryRows = statusSummaryRows;

  const summary = await resolveDashboardSummary(ctx);
  return buildMetricsPayload(ctx, summary, statusSummaryRows);
}

/** Chart widgets — runs after metrics; reuses cached by-date payload when possible. */
export async function fetchAccountsDashboardCharts(options = {}, metricsContext = null) {
  const ctx = metricsContext ?? resolveDashboardContext(options);
  if (!metricsContext) {
    const [byDateOnlyPayload, statusSummaryRows] = await Promise.all([
      fetchOrNull(ctx.byDateOnlyEndpoint, ctx.pagedDateParams),
      fetchStatusSummary({
        institutionCode: ctx.scope,
        dateRange: ctx.resolvedRange,
        isCurrent: ctx.dateParams.isCurrent !== "false",
      }),
    ]);
    ctx.cache.byDateOnlyPayload = byDateOnlyPayload;
    ctx.cache.statusSummaryRows = statusSummaryRows;
    ctx.cache.summary = await resolveDashboardSummary(ctx);
  }

  const summary = ctx.cache.summary;
  const statusSummaryRows = ctx.cache.statusSummaryRows;

  const chartRequests = [
    fetchOrNull(ctx.channelsEndpoint, ctx.pagedDateParams),
    fetchOrNull(ctx.failedCodesEndpoint, ctx.pagedDateParams),
    fetchOrNull(ctx.averageTimeEndpoint, ctx.averageTimeParams),
    fetchOrNull(ctx.successEndpoint, ctx.dateParams),
  ];
  if (!ctx.scope) {
    chartRequests.push(fetchOrNull(ctx.failingInstitutionsEndpoint, ctx.pagedDateParams));
  }

  const chartResults = await Promise.all(chartRequests);
  ctx.cache.channelsPayload = chartResults[0];
  ctx.cache.failedCodesPayload = chartResults[1];
  ctx.cache.averageTimePayload = chartResults[2];
  ctx.cache.successPayload = chartResults[3];
  if (!ctx.scope) {
    ctx.cache.failingInstitutionsPayload = chartResults[4];
  }

  return buildChartsPayload(ctx, summary, statusSummaryRows);
}

export async function fetchAccountsDashboardData({
  institutionCode,
  date,
  dateRange,
  requireInstitutionScope = false,
  onMetricsReady,
} = {}) {
  const options = { institutionCode, date, dateRange, requireInstitutionScope };
  const ctx = resolveDashboardContext(options);

  const metrics = await fetchAccountsDashboardMetrics(options);
  if (typeof onMetricsReady === "function") {
    onMetricsReady(metrics);
  }

  const charts = await fetchAccountsDashboardCharts(options, ctx);
  return {
    ...metrics,
    ...charts,
    hasTransactions: Boolean(metrics.hasTransactions || charts.hasTransactions),
  };
}

export async function fetchInstitutionFailedCodeBreakdown({ institutionCode, date, dateRange } = {}) {
  const scope = institutionCodeForDashboardScope(institutionCode);
  if (!scope) return [];

  const resolvedRange =
    dateRange ?? (date ? { start: date, end: date } : null) ?? defaultDashboardDateRange();
  const payload = await fetchOrNull(
    API_ENDPOINTS.dashboards.topFailedResponseCodesByInstitution(scope),
    withPagination(buildDateRangeParams(resolvedRange))
  );

  return normalizeResponseCodes(normalizeFailedCodes(payload));
}

export async function fetchStatusSummary({ institutionCode, dateRange, isCurrent = true } = {}) {
  const resolvedRange = dateRange ?? defaultDashboardDateRange();
  const dateParams = buildDateRangeParams(resolvedRange);
  const params = {
    ...dateParams,
    isCurrent: isCurrent ? "true" : "false",
  };
  const scope = institutionCodeForDashboardScope(institutionCode);
  if (scope) params.institution = scope;

  const payload = await fetchOrNull(API_ENDPOINTS.dashboards.statusSummary, params);
  return normalizeStatusSummaryRows(payload);
}

export const LIVE_FEED_POLL_MS = 5000;

export async function fetchLiveTransactionFeed(options = {}) {
  return fetchLiveFeedFromApi(options);
}

/** Equal-length range immediately before `range`. */
export function priorPeriodRange(range) {
  const { start, end } = normalizeDashboardDateRange(range);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  return normalizeDashboardDateRange({ start: priorStart, end: priorEnd });
}

function formatInsightCount(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

function formatInsightVolume(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return "₦0";
  if (Math.abs(n) >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `₦${(n / 1e3).toFixed(1)}k`;
  return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

/** One-line insight summary for the analytics section header. */
export function buildInsightSummary(statsData) {
  const summary = statsData?.rawSummary;
  const counts = statsData?.statusCounts;
  const total =
    Number(summary?.totalTransactions) ||
    (counts ? (counts.successful || 0) + (counts.pending || 0) + (counts.failed || 0) : 0);
  const successCount = Number(counts?.successful ?? summary?.successCount ?? 0);
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : "0.0";
  const volume = Number(summary?.totalAmount ?? 0);
  return `${formatInsightCount(total)} transactions · ${successRate}% success · ${formatInsightVolume(volume)} volume`;
}

function sumPieValues(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + (Number(row?.value) || 0), 0);
}

function pickPieValue(rows, matcher) {
  if (!Array.isArray(rows)) return 0;
  const row = rows.find((r) => matcher(String(r?.name || "").toLowerCase()));
  return Number(row?.value) || 0;
}

function dominantChannel(channelRows) {
  if (!Array.isArray(channelRows) || !channelRows.length) return null;
  const sorted = [...channelRows].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
  const top = sorted[0];
  const total = channelRows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const share = total > 0 ? ((Number(top.count) / total) * 100).toFixed(1) : "0";
  return { name: top.channel, share };
}

/** KPI headlines for each analytics chart card. */
export function buildChartCardMeta(statsData, resolvedRange, priorStats = null) {
  const range = resolvedRange ? formatDashboardRangeLabel(resolvedRange) : "";
  const summary = statsData?.rawSummary || {};
  const pie = statsData?.successFailurePie || [];
  const pieTotal = sumPieValues(pie);
  const successVal = pickPieValue(pie, (n) => n.includes("success"));
  const failedVal = pickPieValue(pie, (n) => n.includes("fail"));
  const successRate = pieTotal > 0 ? ((successVal / pieTotal) * 100).toFixed(1) : "0.0";
  const heroTotal = (statsData?.chartData7d || []).reduce(
    (s, r) => s + (Number(r.transactions) || 0),
    0,
  );
  const heroValue = (statsData?.chartData7d || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const topCode = (statsData?.failedTop5Codes || [])[0];
  const failedTotal = (statsData?.failedTop5Codes || []).reduce((s, r) => s + (Number(r.count) || 0), 0);
  const channel = dominantChannel(statsData?.transactionsByChannel);
  const ftAvg = Number(statsData?.averageTime?.ft ?? 0);

  const priorHeroTotal = (priorStats?.chartData7d || []).reduce(
    (s, r) => s + (Number(r.transactions) || 0),
    0,
  );
  const priorPie = priorStats?.successFailurePie || [];
  const priorPieTotal = sumPieValues(priorPie);
  const priorSuccessVal = pickPieValue(priorPie, (n) => n.includes("success"));
  const priorSuccessRate = priorPieTotal > 0 ? (priorSuccessVal / priorPieTotal) * 100 : 0;
  const priorFailedTotal = (priorStats?.failedTop5Codes || []).reduce(
    (s, r) => s + (Number(r.count) || 0),
    0,
  );

  function delta(current, prior) {
    if (!priorStats || !Number.isFinite(prior) || prior === 0) return undefined;
    const pct = ((Number(current) - prior) / prior) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% vs prior`;
  }

  return {
    hero: {
      subtitle: range,
      kpi: {
        label: "Total volume",
        value: formatInsightCount(heroTotal || summary.totalTransactions || 0),
        delta: delta(heroTotal || summary.totalTransactions, priorHeroTotal),
      },
      kpiSecondary: {
        label: "Total value",
        value: formatInsightVolume(heroValue || summary.totalAmount),
      },
    },
    status: {
      subtitle: range,
      kpi: {
        label: "Success rate",
        value: `${successRate}%`,
        delta: delta(Number(successRate), priorSuccessRate),
      },
    },
    avgTime: {
      subtitle: range,
      kpi: { label: "FT average", value: `${ftAvg.toFixed(1)}s` },
    },
    failedCodes: {
      subtitle: range,
      kpi: {
        label: topCode ? `Top: ${topCode.code}` : "Failures",
        value: formatInsightCount(failedTotal || failedVal),
        delta: delta(failedTotal || failedVal, priorFailedTotal),
      },
    },
    channels: {
      subtitle: range,
      kpi: channel
        ? { label: "Leading channel", value: `${channel.name} (${channel.share}%)` }
        : { label: "Channels", value: "—" },
    },
    institutions: {
      subtitle: range,
      kpi: {
        label: "Institutions",
        value: formatInsightCount((statsData?.failureByInstitution || []).length),
      },
    },
    successLine: {
      subtitle: range,
      kpi: {
        label: "Successful",
        value: formatInsightCount(
          (statsData?.successVolumes7d || []).reduce((s, r) => s + (Number(r.volume) || 0), 0) ||
            successVal,
        ),
      },
    },
  };
}

/** Fetch chart payload for the prior equal-length period (for comparison deltas). */
export async function fetchPriorPeriodDashboardCharts(options = {}) {
  const { dateRange, ...rest } = options;
  if (!dateRange) return null;
  try {
    return await fetchAccountsDashboardCharts({
      ...rest,
      dateRange: priorPeriodRange(dateRange),
    });
  } catch {
    return null;
  }
}

function normalizeDashboardCompareSlice(slice) {
  if (!slice || typeof slice !== "object") return null;
  const byDatePayload = {
    data: slice.byDateRows,
    meta: slice.byDateMeta,
  };
  const chartData7d = normalizeTrendRows(byDatePayload);
  const statusSummaryRows = normalizeStatusSummaryRows({ summary: slice.statusSummary });
  const failedTop5Codes = normalizeResponseCodes(normalizeFailedCodes({ data: slice.failedTop5Codes }));
  const successFailurePie = buildStatusSummaryPie(statusSummaryRows, null);
  return {
    chartData7d,
    successFailurePie,
    failedTop5Codes,
    hasTransactions:
      chartData7d.some((row) => Number(row.transactions) > 0) ||
      successFailurePie.length > 0 ||
      failedTop5Codes.length > 0,
  };
}

/** Single API call for current + prior dashboard comparison slices. Falls back to null on 404. */
export async function fetchDashboardCompare(options = {}) {
  const ctx = resolveDashboardContext(options);
  const params = {
    ...ctx.dateParams,
    institution: ctx.scope || undefined,
  };
  try {
    const payload = await apiClient.get(API_ENDPOINTS.dashboards.dashboardCompare, params);
    const raw = getRawResponseObject(payload);
    const block = Array.isArray(raw?.data) ? raw.data[0] : raw?.data?.[0] ?? raw;
    if (!block || typeof block !== "object") return null;
    const prior = normalizeDashboardCompareSlice(block.prior);
    if (!prior) return null;
    return {
      ...prior,
      priorRange: block.priorRange,
      currentSlice: normalizeDashboardCompareSlice(block.current),
    };
  } catch {
    return null;
  }
}

/** Prefer compare endpoint; fall back to full prior-period chart fetch. */
export async function fetchPriorPeriodForDashboard(options = {}) {
  const compare = await fetchDashboardCompare(options);
  if (compare) {
    const { priorRange, currentSlice, ...priorStats } = compare;
    return priorStats;
  }
  return fetchPriorPeriodDashboardCharts(options);
}

