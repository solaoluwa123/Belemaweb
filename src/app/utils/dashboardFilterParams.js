import { normalizeDashboardDateRange } from "../services/dashboards";

function pad(n) {
  return String(n).padStart(2, "0");
}

/** URL-safe calendar date `YYYY-MM-DD` (local). */
export function formatFilterDateParam(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseFilterDateParam(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Serialize dashboard filters for query strings. */
export function dashboardFiltersToSearchParams({ dateRange, institution } = {}) {
  const params = new URLSearchParams();
  if (dateRange) {
    const { start, end } = normalizeDashboardDateRange(dateRange);
    const from = formatFilterDateParam(start);
    const to = formatFilterDateParam(end);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  if (institution && institution !== "all") {
    params.set("institution", institution);
  }
  return params;
}

/** Read dashboard filters from `URLSearchParams` or location search string. */
export function parseDashboardFiltersFromSearch(search) {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  if (!params) return { dateRange: null, institution: "all" };

  const from = parseFilterDateParam(params.get("from"));
  const to = parseFilterDateParam(params.get("to"));
  const institution = params.get("institution") || "all";

  let dateRange = null;
  if (from || to) {
    dateRange = normalizeDashboardDateRange({
      start: from || to,
      end: to || from,
    });
  }

  return { dateRange, institution };
}

/** Append filter query string to a route path. */
export function appendDashboardFiltersToPath(path, filters = {}) {
  const qs = dashboardFiltersToSearchParams(filters).toString();
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

/** Build transaction list deep link with optional filters. */
export function buildTransactionListLink({ responseCode, dateRange, institution, status } = {}) {
  const params = new URLSearchParams();
  if (responseCode) params.set("responseCode", String(responseCode));
  if (status && status !== "all") params.set("status", String(status));
  if (dateRange) {
    const { start, end } = normalizeDashboardDateRange(dateRange);
    const from = formatFilterDateParam(start);
    const to = formatFilterDateParam(end);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  if (institution && institution !== "all") {
    params.set("institution", institution);
  }
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}
