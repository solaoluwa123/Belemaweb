import { APIError, API_ENDPOINTS, apiClient } from "./api";
import { fetchTransactionDetails } from "./transactions";

// ---------------------
// Utility functions
// ---------------------

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

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Dispute settlement status: Pending (default), Accepted, Rejected, Arbitrated. */
function normalizeStatus(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "Pending";
  if (/^-?\d+$/.test(lower)) {
    if (Number(lower) === -1) return "Arbitrated";
    if (Number(lower) === 0) return "Pending";
    if (Number(lower) === 1) return "Accepted";
    if (Number(lower) === 2) return "Rejected";
  }
  if (lower.includes("reject") || lower.includes("declin")) return "Rejected";
  if (lower.includes("accept") || lower.includes("approv") || lower.includes("success")) return "Accepted";
  if (lower.includes("arbitrat")) return "Arbitrated";
  if (lower.includes("pending") || lower.includes("review")) return "Pending";
  return raw || "Pending";
}

function normalizeDispute(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const resolvedFlag = Number(firstDefined(source.resolved, source.isResolved, source.resolvedFlag, 0));
  const rawStatus = String(firstDefined(source.status, source.current_status, "")).trim();
  const numericStatus = /^-?\d+$/.test(rawStatus) ? Number(rawStatus) : null;
  const isArbitrated = numericStatus === -1 || String(rawStatus).toLowerCase().includes("arbitrat");
  const settlementStatus = isArbitrated
    ? "Arbitrated"
    : resolvedFlag > 0
      ? normalizeStatus(rawStatus)
      : "Pending";
  return {
    id: String(firstDefined(source.id, source.disputeId, source.transactionId, `DIS${index + 1}`)),
    sessionId: String(firstDefined(source.srcSessionid, source.sessionId, source.session_id, source.transactionId, "")),
    transactionId: String(firstDefined(source.transactionId, source.transactionid, source.srcSessionid, source.sessionId, source.session_id, "")),
    sourceAccountName: String(firstDefined(source.srcAccountName, source.originator_account_name, source.sourceAccountName, source.accountNameFrom, "")),
    sourceBank: String(firstDefined(source.srcInstitutionName, source.sourceBank, source.institutionFrom, "")),
    sourceAccountNumber: String(firstDefined(source.srcAccountNumber, source.sourceAccountNumber, "")),
    beneficiaryAccountName: String(firstDefined(source.destAccountName, source.beneficiary_account_name, source.beneficiaryAccountName, source.accountNameTo, "")),
    beneficiaryBank: String(firstDefined(source.destInstitutionName, source.beneficiaryBank, source.institutionTo, "")),
    beneficiaryAccountNumber: String(firstDefined(source.destAccountNumber, source.beneficiaryAccountNumber, "")),
    amount: toNumber(firstDefined(source.srcAmount, source.amount, source.destAmount)),
    reason: String(firstDefined(source.reason, source.narration, source.responseCodeDefinition, source.records, "")),
    description: String(firstDefined(source.description, source.narration, source.records, "")),
    disputeType: String(firstDefined(source.disputeType, source.type, "")),
    submittedBy: String(firstDefined(source.submittedBy, source.loggedBy, source.username, "")),
    submittedDate: String(firstDefined(source.submittedDate, source.dateCreated, source.date_created, source.transactiondate, source.createdAt, "")),
    timelineDate: String(firstDefined(source.timeline_date, source.timelineDate, source.dateModified, source.date_modified, source.dateCreated, "")),
    currentStatusCode: settlementStatus,
    newStatusCode: String(firstDefined(source.type, source.new_status, "")),
    resolvedBy: String(firstDefined(source.resolvedBy, source.resolved_by, "")),
    status: settlementStatus,
    /** Raw status string from the API (used for arbitrated / non-settlement states). */
    originalStatus: isArbitrated ? "Arbitrated" : rawStatus,
  };
}

function normalizeDisputes(payload) {
  return asArray(payload).map(normalizeDispute);
}

function formatDateParams(filters = {}) {
  const params = {};
  if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
  if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
  if (filters.status) params.status = filters.status;
  if (filters.searchTerm) params.search = filters.searchTerm;
  return params;
}

// ---------------------
// Dispute API functions
// ---------------------

export async function fetchDisputes({
  institutionCode,
  filters = {},
  requireInstitutionScope = false,
} = {}) {
  const code = String(institutionCode ?? "").trim();
  if (requireInstitutionScope && (!code || code === "-1")) {
    throw new APIError("Institution code is required for this role.", 400, null);
  }

  const params = formatDateParams(filters);

  // Backend requires pagination for the generic search endpoint.
  // We request a large first page because this UI paginates client-side.
  const DEFAULT_SEARCH_PAGE = 1;
  const DEFAULT_SEARCH_LIMIT = 1000;
  const page = filters.page ? Number(filters.page) : DEFAULT_SEARCH_PAGE;
  const limit = filters.limit ? Number(filters.limit) : DEFAULT_SEARCH_LIMIT;

  if (code && code !== "-1") {
    params.institutioncode = code;
  }

  const hasFilters = filters.searchTerm || filters.status || filters.startDate || filters.endDate;
  const endpoint =
    hasFilters || requireInstitutionScope
      ? API_ENDPOINTS.disputes.search
      : code && code !== "-1"
        ? API_ENDPOINTS.disputes.listByInstitution(code)
        : API_ENDPOINTS.disputes.search;

  const finalParams =
    endpoint === API_ENDPOINTS.disputes.search
      ? { ...params, page, limit }
      : Object.keys(params).length
        ? params
        : undefined;

  const payload = await apiClient.get(endpoint, finalParams);
  return normalizeDisputes(payload);
}

/**
 * Arbitrated disputes for an institution. Uses the dedicated endpoint when available;
 * otherwise loads disputes and filters by status text.
 */
export async function fetchArbitratedDisputes({ institutionCode, requireInstitutionScope = false } = {}) {
  if (institutionCode && institutionCode !== "-1") {
    try {
      const payload = await apiClient.get(
        API_ENDPOINTS.disputes.arbitratedByInstitution(institutionCode),
      );
      const rows = normalizeDisputes(payload);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
  }
  const all = await fetchDisputes({ institutionCode, requireInstitutionScope });
  return all.filter((d) => {
    const label = `${d.originalStatus || ""} ${d.status || ""}`.toLowerCase();
    return label.includes("arbitrat");
  });
}

export async function fetchDisputeDetails(id) {
  if (!id) throw new APIError("A dispute ID is required.", 400, null);
  const payload = await apiClient.get(API_ENDPOINTS.disputes.details(id));
  return normalizeDisputes(payload)[0] ?? null;
}

/** `GET /transactions/disputes/types/get` — for dispute forms. */
export async function fetchDisputeTypes() {
  const payload = await apiClient.get(API_ENDPOINTS.disputes.types);
  const rows = asArray(payload);
  return rows.map((t, i) => {
    if (t != null && typeof t !== "object") {
      const s = String(t);
      return { value: s.toLowerCase().replace(/\s+/g, "_") || `type_${i}`, label: s, raw: t };
    }
    const o = t && typeof t === "object" ? t : {};
    const name = String(firstDefined(o.name, o.description, o.type, o.label, `Dispute type ${i + 1}`));
    const code = String(firstDefined(o.code, o.disputeType, o.id, name))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    return { value: code || `type_${i}`, label: name, raw: o };
  });
}

/**
 * Coerce a value to a backend `int`. Empty strings / null / NaN → fallback.
 * The dispute schema marks `id`, `transactionId`, `status`, `resolved` as integers,
 * and Spring rejects (or silently bricks the row) when these come in as strings.
 */
function toIntOr(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Submit a new dispute via `PUT /transactions/disputes/create`.
 *
 * The backend deserialises a full transaction-shaped record (per the Swagger
 * schema: `srcSessionid`, `srcAccountName`, `srcInstitutioncode`, … plus the
 * dispute-specific fields). Many of those columns are `NOT NULL` in
 * `tbl_disputes`, so sending a minimal body produces SQL errors that surface as
 * `500 Internal Server Error`. This helper:
 *
 *   1. Looks up the original transaction by `sessionId` (when not supplied)
 *      so every source / destination field is populated.
 *   2. Overlays the dispute-specific fields (`type`, `narration`,
 *      `responseCodeDefinition`, `records`, `srcAmount`, `loggedBy`,
 *      `username`).
 *   3. Coerces integer-typed columns to numbers (`id`, `transactionId`,
 *      `status`, `resolved`).
 *   4. Sets sensible defaults for newly-logged disputes (`status: 0`,
 *      `resolved: 0`, `id: 0`, `dateCreated` / `dateModified` / `timeline_date`
 *      to now).
 *
 * Callers can pass an explicit `transaction` row (preferred — saves a network
 * round-trip) or just rely on the internal `fetchTransactionDetails` fallback.
 */
export async function createDispute({
  transactionId,
  disputeType,
  reason,
  amount,
  description,
  submittedBy = "",
  loggingInstitution = "",
  transaction = null,
}) {
  if (!transactionId || !disputeType || !reason || !amount || !description) {
    throw new APIError("Complete the required dispute fields before submitting.", 400, null);
  }

  // Resolve the raw backend record for the transaction so we can carry every
  // source/destination field forward. Failure here is non-fatal — we still try
  // to submit, just with a thinner body.
  let raw = {};
  if (transaction && typeof transaction === "object") {
    raw = transaction.raw && typeof transaction.raw === "object" ? transaction.raw : transaction;
  } else {
    try {
      const tx = await fetchTransactionDetails(transactionId);
      if (tx?.raw && typeof tx.raw === "object") raw = tx.raw;
    } catch {
      /* swallow — the dispute can still be created without the lookup. */
    }
  }

  const pick = (...keys) => {
    for (const k of keys) {
      const v = raw[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  };

  const nowIso = new Date().toISOString();

  return apiClient.put(API_ENDPOINTS.disputes.create, {
    id: 0,
    srcSessionid: String(pick("srcSessionid", "sessionId", "session_id") || transactionId),
    paymentReference: String(pick("paymentReference", "payment_reference")),
    srcAccountNumber: String(pick("srcAccountNumber", "sourceAccountNumber")),
    srcAccountName: String(pick("srcAccountName", "sourceAccountName")),
    srcKycLevel: String(pick("srcKycLevel", "src_kyc_level")),
    srcBvn: String(pick("srcBvn", "src_bvn")),
    srcAmount: String(amount),
    srcInstitutioncode: String(
      pick("srcInstitutioncode", "srcInstitutionCode", "sourceInstitutionCode", "source_institution_code")
    ),
    destSessionId: String(pick("destSessionId", "dest_session_id")),
    srcResponsecode: String(pick("srcResponsecode", "srcResponseCode")),
    destAccountNumber: String(pick("destAccountNumber", "beneficiaryAccountNumber")),
    destAccountName: String(pick("destAccountName", "beneficiaryAccountName")),
    destKycLevel: String(pick("destKycLevel")),
    destBvn: String(pick("destBvn")),
    destAmount: String(pick("destAmount") || amount),
    destInstitutioncode: String(
      pick("destInstitutioncode", "destInstitutionCode", "destinationInstitutionCode")
    ),
    destResponseCode: String(pick("destResponseCode")),
    narration: String(reason),
    transactiondate: String(pick("transactiondate", "transactionDate", "dateCreated")),
    username: String(submittedBy),
    responseCodeDefinition: String(reason),
    txnDuration: String(pick("txnDuration")),
    responsedatetime: String(pick("responsedatetime", "responseDateTime")),
    channelCode: String(pick("channelCode", "channel")),
    srcInstitutionName: String(pick("srcInstitutionName", "sourceInstitutionName")),
    destInstitutionName: String(pick("destInstitutionName", "destinationInstitutionName")),
    destNodeInstitutionName: String(pick("destNodeInstitutionName")),
    type: String(disputeType),
    loggedBy: String(submittedBy),
    dateModified: nowIso,
    dateCreated: nowIso,
    transactionId: toIntOr(pick("transactionId", "id"), 0),
    status: 0,
    resolved: 0,
    resolvedBy: "",
    records: String(description),
    timeline_date: nowIso,
    proof_of_reject_uri: "",
    loggingInstitution: String(loggingInstitution),
    selectedDisputes: "",
  });
}

/**
 * Approve or reject disputes — `POST /transactions/disputes/approve`.
 */
export async function approveDisputes({
  status,
  selectedDisputes,
  username,
  type = "",
  proofOfRejectUri = "",
}) {
  if (!selectedDisputes?.length && !String(selectedDisputes || "").trim()) {
    throw new APIError("Select at least one dispute.", 400, null);
  }
  const ids = Array.isArray(selectedDisputes)
    ? selectedDisputes.map((id) => String(id).trim()).filter(Boolean)
    : [String(selectedDisputes).trim()].filter(Boolean);

  return apiClient.post(API_ENDPOINTS.disputes.approve, {
    status: String(status || "").trim(),
    selectedDisputes: ids.join(","),
    username: String(username || "").trim(),
    type: String(type || "").trim(),
    proof_of_reject_uri: String(proofOfRejectUri || "").trim(),
  });
}
