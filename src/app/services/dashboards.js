import { API_ENDPOINTS, apiClient } from "./api";
import {
  buildBackendTransactionSearchParams,
  fetchTransactionSearchRaw,
  fetchTransactions,
  fetchTransactionsByInstitution,
} from "./transactions";
import { fetchDisputes } from "./disputes";
import { parseBackendDate, getBackendDateTime } from "../utils/formatters";

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

/**
 * Dashboard metrics and charts are scoped to the selected calendar day only.
 * If that day has no transactions, the UI shows an empty state instead of zeros.
 */
function buildDateRangeParams(date) {
  if (!date) return {};
  const selectedDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(selectedDate.getTime())) return {};

  const day = startOfLocalDay(selectedDate);
  return {
    startDate: formatDashboardRangeDateParam(day),
    endDate: formatDashboardRangeDateParam(endOfLocalDay(day)),
  };
}

/** Same selected-day window as `buildDateRangeParams`, as `Date` objects for `/transactions/q/search`. */
function getDashboardRangeAsDates(date) {
  if (!date) return null;
  const selectedDate = date instanceof Date ? date : new Date(date);
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
  const useMeta = metaAgg && metaAgg.totalTransactions > 0;
  const useRows = !useMeta && rowAgg && rowAgg.totalTransactions > 0;
  if (!shouldFillDashboardMetricsFromTransactions(summary) || (!useMeta && !useRows)) return summary;

  const agg = useMeta ? metaAgg : rowAgg;
  const totalTransactions = agg.totalTransactions;
  const totalAmount = agg.totalAmount;
  const successCount = agg.successCount;
  const successRate =
    useMeta && Number.isFinite(metaAgg.successRate)
      ? metaAgg.successRate
      : totalTransactions > 0
        ? (successCount / totalTransactions) * 100
        : 0;

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
  return asArray(payload)
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
  return asArray(payload)
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        channel: pickString(source, ["channel", "name", "label", "channelName"]),
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

  if (successRows.length > 1) {
    return successRows;
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

function normalizeLiveMonitoringPlaceholder() {
  return {
    rows: [],
    unsupported: false,
    message: "",
  };
}

function pickNumberOrUndefined(source, keys) {
  for (const key of keys) {
    const v = source?.[key];
    if (v === undefined || v === null || v === "") continue;
    const n = toNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeLiveMonitoringTimeSeries(institutionRow) {
  const rawSeries =
    institutionRow?.timeSeries ??
    institutionRow?.time_series ??
    institutionRow?.series ??
    institutionRow?.data ??
    institutionRow?.chart ??
    institutionRow?.points ??
    null;

  // Case A: already an array of time points: [{time,inflow,outflow}, ...]
  const seriesRows = asArray(rawSeries);
  if (seriesRows.length > 0) {
    return seriesRows
      .map((pt) => {
        const source = pt && typeof pt === "object" ? pt : {};
        return {
          time: pickString(source, ["time", "label", "t", "timestamp", "datetime", "date", "period"]) || "",
          inflow: pickNumber(source, ["inflow", "inflowValue", "inflowVolume", "inward", "inValue"]) || 0,
          outflow: pickNumber(source, ["outflow", "outflowValue", "outflowVolume", "outward", "outValue"]) || 0,
        };
      })
      .filter((row) => row.time);
  }

  // Case B: separate arrays (mock-like): inflowData/outflowData + optional timeLabels
  const inflowArr = asArray(
    institutionRow?.inflowData ?? institutionRow?.inflow ?? institutionRow?.inflow_values ?? []
  );
  const outflowArr = asArray(
    institutionRow?.outflowData ?? institutionRow?.outflow ?? institutionRow?.outflow_values ?? []
  );
  const timeLabelsArr = asArray(
    institutionRow?.timeLabels ?? institutionRow?.time_labels ?? institutionRow?.labels ?? []
  );
  const n = Math.max(inflowArr.length, outflowArr.length, timeLabelsArr.length);
  if (n === 0) return [];

  const labels =
    timeLabelsArr.length === n
      ? timeLabelsArr
      : Array.from({ length: n }, (_, i) => String(i + 1));

  return labels.map((label, i) => ({
    time: String(label),
    inflow: toNumber(inflowArr[i]),
    outflow: toNumber(outflowArr[i]),
  }));
}

function normalizeLiveMonitoringRows(payload) {
  const rows = asArray(payload);

  return rows
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};

      const name = pickString(source, [
        "name",
        "institutionName",
        "financialInstitutionName",
        "institution",
        "institutionLabel",
      ]);
      if (!name) return null;

      const timeSeries = normalizeLiveMonitoringTimeSeries(source);

      // Prefer explicit success/failure percentages if provided
      const inflowSuccess = pickNumberOrUndefined(source, [
        "inflowSuccess",
        "inflow_success",
        "inflowSuccessRate",
        "inflow_success_rate",
      ]);
      const inflowFailure = pickNumberOrUndefined(source, ["inflowFailure", "inflow_failure", "inflowFailureRate"]);
      const outflowSuccess = pickNumberOrUndefined(source, [
        "outflowSuccess",
        "outflow_success",
        "outflowSuccessRate",
        "outflow_success_rate",
      ]);
      const outflowFailure = pickNumberOrUndefined(source, ["outflowFailure", "outflow_failure", "outflowFailureRate"]);

      const inflowSuccessFinal = inflowSuccess ?? (inflowFailure !== undefined ? 100 - inflowFailure : 0);
      const inflowFailureFinal = inflowFailure ?? (inflowSuccess !== undefined ? 100 - inflowSuccess : 100);
      const outflowSuccessFinal = outflowSuccess ?? (outflowFailure !== undefined ? 100 - outflowFailure : 0);
      const outflowFailureFinal = outflowFailure ?? (outflowSuccess !== undefined ? 100 - outflowSuccess : 100);

      const maxVal = Math.max(
        0,
        ...timeSeries.flatMap((pt) => [Number(pt.inflow) || 0, Number(pt.outflow) || 0])
      );
      const yAxisDomain = maxVal > 0 ? [0, Math.ceil(maxVal)] : [-1, 1];

      return {
        name,
        timeSeries,
        inflowSuccess: inflowSuccessFinal,
        inflowFailure: inflowFailureFinal,
        outflowSuccess: outflowSuccessFinal,
        outflowFailure: outflowFailureFinal,
        yAxisDomain: source.yAxisDomain ?? yAxisDomain,
      };
    })
    .filter(Boolean);
}

function buildLiveMonitoringDateRange() {
  // Match existing mock UI density: 10 points over ~90 minutes.
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 90 * 60 * 1000);
  return {
    startDate: formatDashboardRangeDateParam(startDate),
    endDate: formatDashboardRangeDateParam(endDate),
  };
}

async function fetchOrNull(endpoint, params) {
  try {
    return await apiClient.get(endpoint, params);
  } catch {
    return null;
  }
}

async function fetchPendingDisputesCount(institutionCode) {
  const code = institutionCodeForDashboardScope(institutionCode);
  if (!code) return 0;
  try {
    const rows = await fetchDisputes({ institutionCode: code });
    return rows.filter((d) => {
      const label = `${d.status || ""} ${d.originalStatus || ""}`.toLowerCase();
      return label.includes("pending") || label.includes("review");
    }).length;
  } catch {
    return 0;
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

export async function fetchAccountsDashboardData({ institutionCode, date, requireInstitutionScope = false } = {}) {
  const scope = institutionCodeForDashboardScope(institutionCode);
  if (requireInstitutionScope && !scope) {
    throw new Error("Institution code is required to load dashboard data.");
  }
  const dateParams = buildDateRangeParams(date);
  const pagedDateParams = withPagination(dateParams);
  /** `GET /ft-average-time` requires `isCurrent` (Spring @RequestParam); do not send only start/end. */
  const averageTimeParams = { ...dateParams, isCurrent: "true" };
  const summaryEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.transactionsSummary,
    API_ENDPOINTS.dashboards.transactionsSummaryByInstitution,
    scope
  );
  const successEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.successfulTransactionCount,
    API_ENDPOINTS.dashboards.successfulTransactionCountByInstitution,
    scope
  );
  const byDateEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.transactionsByDate,
    API_ENDPOINTS.dashboards.transactionsByDateByInstitution,
    scope
  );
  const byDateOnlyEndpoint = scope
    ? API_ENDPOINTS.dashboards.transactionsByDateOnlyByInstitution(scope)
    : API_ENDPOINTS.dashboards.transactionsByDateOnly;
  const channelsEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.transactionsByChannels,
    API_ENDPOINTS.dashboards.transactionsByChannelsByInstitution,
    scope
  );
  const failedCodesEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.topFailedResponseCodes,
    API_ENDPOINTS.dashboards.topFailedResponseCodesByInstitution,
    scope
  );
  const failingInstitutionsEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.topFailingInstitutions,
    API_ENDPOINTS.dashboards.topFailingInstitutionsByInstitution,
    scope
  );
  const averageTimeEndpoint = getScopedEndpoint(
    API_ENDPOINTS.dashboards.ftAverageTime,
    API_ENDPOINTS.dashboards.ftAverageTimeByInstitution,
    scope
  );
  /** `GET /transactions-trend/{code}` requires `type` + `auth-token`; use global `transactions-by-date` when not scoped. */
  const trendEndpoint = scope
    ? API_ENDPOINTS.dashboards.transactionsTrendByInstitution(scope)
    : byDateEndpoint;
  const trendParams = scope ? { ...dateParams, type: "day" } : pagedDateParams;

  const txnSearchPromise = (async () => {
    const range = getDashboardRangeAsDates(date);
    if (!range) return { rows: [], metaAgg: null };
    try {
      return await fetchTransactionSearchRaw(
        buildBackendTransactionSearchParams({
          userInstitutionCode: scope,
          startDate: range.start,
          endDate: range.end,
          page: 1,
          limit: 800,
        }),
      );
    } catch {
      return { rows: [], metaAgg: null };
    }
  })();

  const [
    summaryPayload,
    successPayload,
    byDatePayload,
    byDateOnlyPayload,
    channelsPayload,
    failedCodesPayload,
    failingInstitutionsPayload,
    averageTimePayload,
    trendPayload,
    txnSearch,
    pendingDisputesCount,
  ] = await Promise.all([
    fetchOrNull(summaryEndpoint, dateParams),
    fetchOrNull(successEndpoint, dateParams),
    fetchOrNull(byDateEndpoint, pagedDateParams),
    fetchOrNull(byDateOnlyEndpoint, pagedDateParams),
    fetchOrNull(channelsEndpoint, pagedDateParams),
    fetchOrNull(failedCodesEndpoint, pagedDateParams),
    fetchOrNull(failingInstitutionsEndpoint, pagedDateParams),
    fetchOrNull(averageTimeEndpoint, averageTimeParams),
    fetchOrNull(trendEndpoint, trendParams),
    txnSearchPromise,
    fetchPendingDisputesCount(scope),
  ]);

  const summaryBase = normalizeSummary(summaryPayload, successPayload, averageTimePayload);
  let workingRows = Array.isArray(txnSearch.rows) ? txnSearch.rows : [];
  let rowAgg = aggregateMetricsFromTransactionRows(workingRows);
  let summary = mergeSummaryWithTransactionSearch(summaryBase, txnSearch.metaAgg, rowAgg);

  /**
   * Final safety net: if everything above still reports zero, hit `GET /transactions` (already-working list)
   * and aggregate client-side over the same window/scope. Slow path; only fires when nothing else has data.
   */
  if (shouldFillDashboardMetricsFromTransactions(summary)) {
    try {
      const scopedRows = await fetchTransactionsForDashboardFallback(scope, dateParams);
      if (scopedRows.length) {
        workingRows = scopedRows;
        rowAgg = aggregateMetricsFromTransactionRows(scopedRows);
        summary = mergeSummaryWithTransactionSearch(summaryBase, null, rowAgg);
      }
    } catch {
      /* keep zero metrics on failure */
    }
  }

  if (pendingDisputesCount > 0 || scope) {
    summary = {
      ...summary,
      pendingDisputes: pendingDisputesCount || summary.pendingDisputes,
      metricCards: {
        ...summary.metricCards,
        pendingDisputes: String(pendingDisputesCount || summary.pendingDisputes || 0),
      },
    };
  }

  let chartData7d = normalizeTrendRows(trendPayload || byDatePayload || byDateOnlyPayload);
  if (!chartData7d.length && workingRows.length) {
    chartData7d = aggregateTrendFromTransactionRows(workingRows);
  }

  const responseCodes = normalizeResponseCodes(normalizeFailedCodes(failedCodesPayload));
  let successVolumes7d = normalizeSuccessVolumes(successPayload, trendPayload || byDatePayload);
  const successFromTxn = aggregateSuccessVolumesFromTransactionRows(workingRows);
  if ((!successVolumes7d || successVolumes7d.length < 1) && successFromTxn.length >= 1) {
    successVolumes7d = successFromTxn;
  }
  const transactionsByChannel = normalizeChannelRows(channelsPayload);
  const failureByInstitution = normalizeInstitutionRows(failingInstitutionsPayload);

  const hasTransactions =
    Number(summary.totalTransactions) > 0 ||
    workingRows.length > 0 ||
    chartData7d.some((row) => Number(row.transactions) > 0 || Number(row.amount) > 0);

  return {
    hasTransactions,
    metrics: summary.metricCards,
    chartData7d: hasTransactions ? chartData7d : [],
    responseCodes: hasTransactions ? responseCodes : [],
    successVolumes7d: hasTransactions ? successVolumes7d : [],
    failedTop5Codes: hasTransactions ? responseCodes : [],
    transactionsByChannel: hasTransactions ? transactionsByChannel : [],
    failureByInstitution: hasTransactions ? failureByInstitution : [],
    averageTime: hasTransactions ? summary.averageTime : { ne: 0, ft: 0 },
    rawSummary: summary,
  };
}

export async function fetchInstitutionFailedCodeBreakdown({ institutionCode, date } = {}) {
  const scope = institutionCodeForDashboardScope(institutionCode);
  if (!scope) return [];

  const payload = await fetchOrNull(
    API_ENDPOINTS.dashboards.topFailedResponseCodesByInstitution(scope),
    withPagination(buildDateRangeParams(date))
  );

  return normalizeResponseCodes(normalizeFailedCodes(payload));
}

export async function fetchLiveMonitoringData() {
  try {
    const dateParams = buildLiveMonitoringDateRange();
    // Swagger shows this endpoint returns time-series "rates" and (typically) success/failure rates per institution.
    const payload = await fetchOrNull(API_ENDPOINTS.dashboards.transactionsRates, dateParams);
    if (!payload) return normalizeLiveMonitoringPlaceholder();
    const rows = normalizeLiveMonitoringRows(payload);
    return {
      rows,
      unsupported: false,
      message: "",
    };
  } catch {
    return normalizeLiveMonitoringPlaceholder();
  }
}

