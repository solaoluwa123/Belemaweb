import { API_ENDPOINTS, APIError, apiClient } from "./api";
import { normalizeDashboardDateRange } from "./dashboards";

/** Sentinel the backend treats as "every institution" (alongside `000013`). */
export const ALL_INSTITUTIONS_CODE = "-1";

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
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

function commissionRowsFromPayload(payload) {
  const root = typeof payload === "string" ? safeJsonParse(payload) : payload;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== "object") return [];
  for (const key of ["data", "records", "items", "results"]) {
    if (Array.isArray(root[key])) return root[key];
  }
  return [];
}

/** `NetworkResponse.meta` arrives as a JSON string: `{"totalValue": n, "totalRecords": n}`. */
function metaFromPayload(payload) {
  const root = typeof payload === "string" ? safeJsonParse(payload) : payload;
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  const meta = typeof root.meta === "string" ? safeJsonParse(root.meta) : root.meta;
  if (!meta || typeof meta !== "object") return null;
  return {
    totalRecords: toNumber(meta.totalRecords ?? meta.total),
    totalValue: toNumber(meta.totalValue ?? meta.totalAmount),
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatSqlDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

/**
 * `GetCommissions` filters with `generation_date >= startDate AND generation_date < endDate`,
 * so the end bound is exclusive — send midnight of the day after the selected end date,
 * otherwise the final day of the range is dropped.
 */
export function buildCommissionDateParams(dateRange) {
  const { start, end } = normalizeDashboardDateRange(dateRange);
  const exclusiveEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0);
  return {
    startDate: formatSqlDateTime(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)),
    endDate: formatSqlDateTime(exclusiveEnd),
  };
}

function normalizeCommissionRow(row, index) {
  const source = row && typeof row === "object" ? row : {};
  const institutionCode = pickString(source, [
    "institution_code",
    "institutionCode",
    "financialInstitutionCode",
  ]);
  const institutionName = pickString(source, [
    "institution_name",
    "institutionName",
    "financialInstitutionName",
    "shortName",
  ]);
  const id = pickString(source, ["id"]);
  const sessionId = pickString(source, ["session_id", "sessionId"]);

  return {
    id: id || sessionId || `commission-${index}`,
    institutionCode,
    institutionName: institutionName || institutionCode,
    totalCount: pickNumber(source, ["total_count", "totalCount"]),
    startDate: pickString(source, ["start_date", "startDate"]),
    endDate: pickString(source, ["end_date", "endDate"]),
    chargeAmount: pickNumber(source, ["charge_amount", "chargeAmount"]),
    totalCommission: pickNumber(source, ["total_commission", "totalCommission"]),
    totalVat: pickNumber(source, ["total_vat", "totalVat"]),
    commission: pickNumber(source, ["commission"]),
    incomeAccountCredited: toNumber(
      source.is_income_acct_credited ?? source.isIncomeAcctCredited ?? 0,
    ) === 1,
    generationDate: pickString(source, ["generation_date", "generationDate"]),
    paidDate: pickString(source, ["paid_date", "paidDate"]),
    sessionId,
    reportLocation: pickString(source, ["report_location", "reportLocation"]),
  };
}

/**
 * `GET /commissions/{institutioncode}` — rows from `ajiswitch_db.tbl_commission_paid`.
 *
 * Third Party Vendors (role 4) are pinned to their own institution by the backend
 * (`vendorInstitutionGate`), which answers 403 for any other code and 400 when the
 * account has no institution linked. Passing `-1` returns every institution.
 */
export async function fetchCommissions({
  institutionCode,
  dateRange,
  requireInstitutionScope = false,
} = {}) {
  const code = String(institutionCode ?? "").trim();
  if (requireInstitutionScope && (!code || code === ALL_INSTITUTIONS_CODE)) {
    throw new APIError("Institution code is required for this role.", 400, null);
  }

  const resolvedCode = code || ALL_INSTITUTIONS_CODE;
  const payload = await apiClient.get(
    API_ENDPOINTS.commissions.byInstitution(encodeURIComponent(resolvedCode)),
    buildCommissionDateParams(dateRange),
  );

  const rows = commissionRowsFromPayload(payload).map(normalizeCommissionRow);
  const meta = metaFromPayload(payload);

  const summedCommission = rows.reduce((sum, row) => sum + (row.commission || row.totalCommission), 0);
  return {
    rows,
    totalRecords: meta?.totalRecords || rows.length,
    totalCommission: meta?.totalValue || summedCommission,
    totalVat: rows.reduce((sum, row) => sum + row.totalVat, 0),
    totalChargeAmount: rows.reduce((sum, row) => sum + row.chargeAmount, 0),
  };
}
