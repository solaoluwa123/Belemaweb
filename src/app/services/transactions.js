import { apiClient, API_ENDPOINTS, APIError } from "./api";
import { fetchInstitutionActions } from "./financialInstitutions";
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

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  const keys = ["data", "result", "results", "records", "content", "items", "response"];
  for (const key of keys) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      return unwrapPayload(parsed[key]);
    }
  }

  return parsed;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  // Prefer the last arg as an explicit default (often ""). `.find()` would return
  // `undefined` instead, and `String(undefined)` becomes the literal "undefined" in the UI.
  return values.length > 0 ? values[values.length - 1] : undefined;
}

/**
 * Avoid `String(undefined)` → `"undefined"` (truthy, so `|| "–"` fallbacks fail).
 */
function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const s = String(value);
  return s === "undefined" || s === "null" ? fallback : s;
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Extract the code portion of a response-code field. The Response Code column
 * must show only the code itself (e.g. "00", "06", "91"), never the textual
 * description that some backends concatenate (e.g. "00 - Approved", "Approved (00)").
 *
 * Returns "" when no code-shaped token (1–4 digits) can be found, so the UI
 * falls back to its empty placeholder ("–").
 */
function extractResponseCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const leading = raw.match(/^\s*(\d{1,4})(?!\d)/);
  if (leading) return leading[1];
  const embedded = raw.match(/\b(\d{1,4})\b/);
  if (embedded) return embedded[1];
  return "";
}

/**
 * ISO-8583 response-code → status keyword.
 *
 * Codes follow the standard switch/NIBSS NIP semantics used by the backend:
 *   - 00 / 10 / 11 / 16  → Successful  (Approved, partial, VIP, approved-update)
 *   - 09                 → Pending     (Request in progress)
 *   - 79                 → Reversed    (Already reversed)
 *   - 17                 → Reversed    (Customer cancellation, treated as reversal)
 *   - any other numeric  → Failed      (declines, errors, format issues, etc.)
 *
 * Empty / non-numeric input returns "" so the caller can fall back to status text.
 */
const RESPONSE_CODE_TO_STATUS = {
  "00": "Successful",
  "10": "Successful",
  "11": "Successful",
  "16": "Successful",
  "09": "Pending",
  "17": "Reversed",
  "79": "Reversed",
};

function statusFromResponseCode(code) {
  const c = String(code || "").trim();
  if (!c || !/^\d+$/.test(c)) return "";
  const key = c.length === 1 ? `0${c}` : c.slice(-2);
  if (key in RESPONSE_CODE_TO_STATUS) return RESPONSE_CODE_TO_STATUS[key];
  return "Failed";
}

/**
 * Classify a status / response value into a single keyword.
 *
 * The transaction Status column must NEVER show free-form backend text
 * (e.g. "00 - Approved by issuer", "TRANSACTION PENDING"). It must collapse
 * to exactly one of: `Successful | Pending | Reversed | Failed | Unknown`.
 *
 * The response code is treated as authoritative when present, because the
 * switch sets it as the canonical decision of the transaction. Free-form
 * status text is only consulted when no code came back from the backend.
 */
function parseStatus(value, responseCode) {
  const codeDerived = statusFromResponseCode(extractResponseCode(responseCode));
  if (codeDerived) return codeDerived;

  const raw = String(firstDefined(value, responseCode, "")).trim();
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();

  if (/\b(reversed|reversal|refund(ed)?|chargeback)\b/.test(lower)) return "Reversed";
  if (/\b(pending|processing|in[\s-]?progress|awaiting|wait(ing)?|queued|request\s+in\s+progress)\b/.test(lower))
    return "Pending";
  if (/\b(success(ful)?|completed|approved|approval|ok)\b/.test(lower)) return "Successful";
  if (
    /\b(fail(ed|ure)?|declin(e|ed)|insufficient|not\s+sufficient|invalid|error|denied|timeout|reject(ed)?|unable|cancell?ed)\b/.test(
      lower,
    )
  )
    return "Failed";

  return "Unknown";
}

function maskPanFromDigits(value) {
  const d = String(value || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return `${d.slice(0, 6)}******${d.slice(-4)}`;
}

function normalizeApiDateTime(value) {
  const raw = safeString(value).trim();
  if (!raw) return "";
  // Backend commonly returns "YYYY-MM-DD HH:mm:ss"; Safari treats this as invalid.
  // Convert to ISO-like local time string so Date parsing works consistently.
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.replace(" ", "T");
  }
  return raw;
}

/**
 * Map institution codes → display names.
 * Prefer `GET /financial-institutions` (live `tbl_nodes`) — matches transaction joins.
 * Merge `GET /financial-institutions/get/actions` (`tbl_nodes_pendings`) as secondary; it often misses live codes.
 */
let institutionNameLookupCache = null;

async function getInstitutionNameLookup() {
  if (institutionNameLookupCache) return institutionNameLookupCache;
  const merged = new Map();

  const mergeInto = (list) => {
    const part = buildInstitutionNameLookup(list);
    for (const [k, v] of part) {
      if (!k || !v) continue;
      const prev = merged.get(k);
      if (!prev || String(v).trim().length > String(prev).trim().length) merged.set(k, v);
    }
  };

  try {
    const payload = await apiClient.get(API_ENDPOINTS.admin.institutions);
    const unwrapped = unwrapPayload(payload);
    if (Array.isArray(unwrapped)) mergeInto(unwrapped);
    else if (unwrapped && typeof unwrapped === "object") {
      const nested = Object.values(unwrapped).find((v) => Array.isArray(v));
      if (nested) mergeInto(nested);
    }
  } catch {
    /* optional: restricted role or network */
  }

  try {
    const { institutions } = await fetchInstitutionActions();
    mergeInto(institutions);
  } catch {
    /* */
  }

  institutionNameLookupCache = merged;
  return institutionNameLookupCache;
}

function normalizeFiCode(code) {
  return String(code ?? "").trim();
}

function buildInstitutionNameLookup(institutions) {
  const map = new Map();
  if (!Array.isArray(institutions)) return map;
  for (const fi of institutions) {
    if (!fi || typeof fi !== "object") continue;
    const code = firstDefined(
      fi.code,
      fi.institutionCode,
      fi.financial_institution_code,
      fi.financialInstitutionCode,
      fi.institution_code,
      ""
    );
    const name = firstDefined(
      fi.financialInstitutionName,
      fi.name,
      fi.institution_name,
      fi.institutionName,
      fi.shortName,
      fi.businessName,
      ""
    );
    const c = normalizeFiCode(code);
    if (!c || !name) continue;
    map.set(String(c), String(name));
    const stripped = c.replace(/^0+/, "") || c;
    if (stripped !== c) map.set(stripped, String(name));
    if (/^\d+$/.test(stripped)) {
      map.set(stripped.padStart(3, "0"), String(name));
      map.set(stripped.padStart(6, "0"), String(name));
    }
  }
  return map;
}

function resolveInstitutionDisplayName(nameKeys, codeKeys, lookup) {
  const direct = firstDefined(...nameKeys);
  if (direct) return String(direct);
  if (lookup && lookup.size) {
    const code = firstDefined(...codeKeys);
    if (code !== undefined && code !== null && code !== "") {
      const c = normalizeFiCode(code);
      const candidates = [c, c.replace(/^0+/, "") || c];
      if (/^\d+$/.test(String(c).replace(/^0+/, "") || "")) {
        const n = String(c).replace(/^0+/, "") || c;
        candidates.push(n.padStart(3, "0"), n.padStart(6, "0"));
      }
      for (const key of candidates) {
        if (!key && key !== 0) continue;
        const hit = lookup.get(String(key));
        if (hit) return hit;
      }
    }
  }
  /* Do not show raw NIBSS / institution codes as "bank name" — names come from API joins or directory above. */
  return "";
}

function normalizeTransaction(row, index = 0, institutionLookup = null) {
  if (!row || typeof row !== "object") {
    return {
      id: `txn-${index}`,
      sessionId: "",
      paymentReferenceNo: "",
      channelCode: "",
      sourceAccountName: "",
      sourceAccountNumber: "",
      sourceBank: "",
      beneficiaryAccountName: "",
      beneficiaryAccountNumber: "",
      beneficiaryBank: "",
      destinationNode: "",
      amount: 0,
      status: "Unknown",
      ftDurationMs: 0,
      dateTime: "",
      responseCode: "",
      responseMessage: "",
      narration: "",
      type: "",
      mti: "",
      maskedPan: "",
      stan: "",
      rrn: "",
      terminalId: "",
      requestTime: "",
      responseTime: "",
      merchantId: "",
      locationNameAddress: "",
      processingCode: "",
      acqId: "",
      destAcqId: "",
      approvalCode: "",
      contactNumber: "",
      reversed: "",
      uuid: "",
      requestedBy: "",
      approvedBy: "",
      currentStatus: "",
      newStatus: "",
      timelineDate: "",
      raw: row,
    };
  }

  const responseCode = firstDefined(
    row.responseCode,
    row.srcResponsecode,
    row.destResponseCode,
    row.statusCode,
    row.response_code,
    "",
  );
  const responseMessage = firstDefined(
    row.responseMessage,
    row.responseCodeDefinition,
    row.statusDescription,
    row.message,
    ""
  );
  const status = parseStatus(firstDefined(row.statusText, row.status, row.transactionStatus), responseCode);

  const sessionId = safeString(firstDefined(row.srcSessionid, row.sessionId, row.session_id, row.transactionId, ""));
  const srcAcct = safeString(firstDefined(row.srcAccountNumber, row.sourceAccountNumber, row.originator_account_number, row.from, ""));
  const dateTime = normalizeApiDateTime(
    firstDefined(
      row.transactiondate,
      row.transaction_date_time,
      row.responsedatetime,
      row.dateTime,
      row.date,
      row.createdAt,
      "",
    )
  );

  // Card-switch fields (MTI/STAN/RRN/terminal/…) are usually absent on NIP/FT rows — leave blank, not fabricated.
  const mti = safeString(firstDefined(row.message_type, row.mti, row.messageType, ""));
  let maskedPan = safeString(firstDefined(row.maskedPan, row.masked_pan, row.maskedPAN, row.panMasked, ""));
  if (!maskedPan && srcAcct) maskedPan = maskPanFromDigits(srcAcct);

  const stan = safeString(firstDefined(row.stan, row.system_trace_number, row.systemTraceNumber, ""));
  const rrn = safeString(firstDefined(row.rrn, row.retrieval_ref_number, row.retrievalRefNumber, row.retrieval_ref_no, ""));
  const terminalId = safeString(firstDefined(row.terminal_id, row.terminalId, ""));
  const requestTime = normalizeApiDateTime(
    firstDefined(row.requestTime, row.request_time, row.transaction_request_time, dateTime, "")
  );
  let responseTime = normalizeApiDateTime(firstDefined(row.responseTime, row.response_time, ""));
  if (!responseTime && status !== "Pending") {
    responseTime = normalizeApiDateTime(firstDefined(row.responsedatetime, row.response_datetime, dateTime, ""));
  }

  const merchantId = safeString(firstDefined(row.merchant_id, row.merchantId, ""));
  const locationNameAddress = safeString(
    firstDefined(
      row.locationNameAddress,
      row.location_name_address,
      row.merchant_location,
      row.location,
      row.merchantAddress,
      ""
    )
  );
  const processingCode = safeString(firstDefined(row.processing_code, row.processingCode, ""));
  const acqId = safeString(
    firstDefined(row.acquiring_institution_id, row.acqId, row.acquirerId, row.acquirer_id, "")
  );
  const destAcqId = safeString(
    firstDefined(row.destination_acquirer_id, row.destAcqId, row.destAcquirerId, row.dest_acquirer_id, "")
  );
  const approvalCode = safeString(firstDefined(row.approval_code, row.approvalCode, ""));
  const contactNumber = safeString(
    firstDefined(row.card_holder_number, row.cardHolderNumber, row.contactNumber, row.mobile, row.phone, "")
  );

  let reversedRaw = firstDefined(row.reversed, row.isReversed, row.reversal_flag, "");
  let reversed = "";
  if (reversedRaw === true || reversedRaw === 1 || reversedRaw === "1") reversed = "yes";
  else if (reversedRaw === false || reversedRaw === 0 || reversedRaw === "0") reversed = "no";
  else if (safeString(reversedRaw).trim()) reversed = safeString(reversedRaw).toLowerCase().includes("y") ? "yes" : "no";

  const uuid = safeString(firstDefined(row.uuid, row.UUID, row.unique_id, row.uniqueLogCode, ""));

  return {
    id: safeString(firstDefined(row.id, row.transactionId, sessionId, row.paymentReference, index), `txn-${index}`),
    sessionId,
    paymentReferenceNo: safeString(firstDefined(row.paymentReference, row.paymentReferenceNo, row.reference, "")),
    channelCode: safeString(firstDefined(row.channelCode, row.channel, "")),
    sourceAccountName: safeString(
      firstDefined(row.srcAccountName, row.sourceAccountName, row.originator_account_name, row.fromName, ""),
    ),
    sourceAccountNumber: srcAcct,
    sourceBank: resolveInstitutionDisplayName(
      [
        row.srcInstitutionName,
        row.sourceInstitutionName,
        row.source_institution_name,
        row.sourceBank,
        row.institutionFrom,
        row.originatingInstitutionName,
      ],
      [
        row.srcInstitutioncode,
        row.srcInstitutionCode,
        row.sourceInstitutionCode,
        row.source_institution_code,
      ],
      institutionLookup
    ),
    beneficiaryAccountName: safeString(
      firstDefined(row.destAccountName, row.beneficiaryAccountName, row.beneficiary_account_name, row.toName, ""),
    ),
    beneficiaryAccountNumber: safeString(firstDefined(row.destAccountNumber, row.beneficiaryAccountNumber, row.to, "")),
    beneficiaryBank: resolveInstitutionDisplayName(
      [
        row.destInstitutionName,
        row.destinationInstitutionName,
        row.destination_institution_name,
        row.beneficiaryBank,
        row.institutionTo,
        row.beneficiaryInstitutionName,
      ],
      [
        row.destInstitutioncode,
        row.destInstitutionCode,
        row.destinationInstitutionCode,
        row.destination_institution_code,
      ],
      institutionLookup
    ),
    destinationNode: safeString(firstDefined(row.destNodeInstitutionName, row.destinationNode, "")),
    sourceInstitutionCode: safeString(
      firstDefined(row.srcInstitutioncode, row.srcInstitutionCode, row.sourceInstitutionCode, row.source_institution_code, ""),
    ),
    destinationInstitutionCode: safeString(
      firstDefined(row.destInstitutioncode, row.destInstitutionCode, row.destinationInstitutionCode, row.destination_institution_code, ""),
    ),
    amount: toNumber(firstDefined(row.srcAmount, row.destAmount, row.amount)),
    status,
    ftDurationMs: toNumber(firstDefined(row.txnDuration, row.ftDurationMs)),
    dateTime,
    responseCode: extractResponseCode(responseCode),
    responseMessage: safeString(responseMessage),
    narration: safeString(firstDefined(row.narration, "")),
    type: safeString(firstDefined(row.type, row.transactionType, "Funds Transfer")),
    mti,
    maskedPan,
    stan,
    rrn,
    terminalId,
    requestTime,
    responseTime,
    merchantId,
    locationNameAddress,
    processingCode,
    acqId,
    destAcqId,
    approvalCode,
    contactNumber,
    reversed,
    uuid,
    requestedBy: safeString(firstDefined(row.requested_by, row.loggedBy, row.username, "")),
    approvedBy: safeString(firstDefined(row.approved_by, row.resolvedBy, "")),
    currentStatus: safeString(firstDefined(row.current_status, "")),
    newStatus: safeString(firstDefined(row.new_status, "")),
    timelineDate: safeString(firstDefined(row.timeline_date, row.dateModified, row.dateCreated, "")),
    raw: row,
  };
}

function looksLikeNetworkEnvelope(obj) {
  if (!obj || typeof obj !== "object") return false;
  const hasEnvelope = obj.message != null && (obj.code != null || obj.status != null);
  const hasTxnHint = Boolean(
    obj.srcSessionid ||
      obj.sessionId ||
      obj.session_id ||
      obj.originator_account_name ||
      obj.srcAccountName ||
      obj.transactiondate ||
      obj.transaction_date_time,
  );
  return hasEnvelope && !hasTxnHint;
}

function normalizeTransactionCollection(payload, institutionLookup = null) {
  const unwrapped = unwrapPayload(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped.map((row, index) => normalizeTransaction(row, index, institutionLookup));
  }

  if (unwrapped && typeof unwrapped === "object") {
    if (looksLikeNetworkEnvelope(unwrapped)) {
      return [];
    }
    const nestedArray = Object.values(unwrapped).find((value) => Array.isArray(value));
    if (nestedArray) {
      return nestedArray.map((row, index) => normalizeTransaction(row, index, institutionLookup));
    }
  }

  return [];
}

function formatDateTimeForApi(date) {
  if (!date) return "";
  const value = parseBackendDate(date);
  if (!value) return "";
  return value.toISOString();
}

/**
 * Backend `SearchTransactions` parses `yyyy-MM-dd'T'HH:mm:ss` local wall time (see `TransactionsService`).
 * ISO strings with `Z` often fail parsing and fall back to a default window.
 */
export function formatSearchRangeDateTimeLocal(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Query params for `GET /transactions/q/search` matching `TransactionsController.SearchTransactions`.
 * When `startDate` / `endDate` parse correctly, `isCurrent` is ignored by the service for table selection.
 */
export function buildBackendTransactionSearchParams({
  userInstitutionCode = "",
  startDate,
  endDate,
  page = 1,
  limit = 500,
} = {}) {
  const q = (v) => String(v ?? "").trim();
  const sd = startDate instanceof Date ? formatSearchRangeDateTimeLocal(startDate) : q(startDate);
  const ed = endDate instanceof Date ? formatSearchRangeDateTimeLocal(endDate) : q(endDate);
  return {
    srcSessionid: "",
    channelCode: "",
    responseCode: "",
    srcAccountNumber: "",
    destAccountNumber: "",
    srcInstitutioncode: "",
    destInstitutioncode: "",
    minAmount: "",
    maxAmount: "",
    startDate: sd,
    endDate: ed,
    page: String(page),
    limit: String(limit),
    isCurrent: "true",
    userInstitutionCode: q(userInstitutionCode),
  };
}

/**
 * `GET /transactions/q/search` — normalized rows plus optional aggregates from `NetworkResponse.meta`
 * (`totalRecords`, `totalValue`, `successRate`) when the API returns them.
 */
export async function fetchTransactionSearchRaw(params) {
  const response = await apiClient.get(API_ENDPOINTS.transactions.search, params);
  const rows = normalizeTransactionCollection(response, null);
  let metaAgg = null;
  const raw = response && typeof response === "object" ? response : {};
  let m = raw.meta;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      m = null;
    }
  }
  if (m && typeof m === "object") {
    const totalRecords = Number(m.totalRecords);
    const totalValue = Number(m.totalValue);
    const successRate = Number(m.successRate);
    if (Number.isFinite(totalRecords) && totalRecords > 0) {
      const sr = Number.isFinite(successRate) ? Math.min(100, Math.max(0, successRate)) : 0;
      metaAgg = {
        totalTransactions: totalRecords,
        totalAmount: Number.isFinite(totalValue) ? totalValue : 0,
        successRate: sr,
        successCount: Math.round((sr / 100) * totalRecords),
      };
    }
  }
  return { rows, metaAgg };
}

function isGlobalInstitutionCode(code) {
  const value = String(code ?? "").trim();
  return !value || value === "-1";
}

/**
 * List all transactions via `GET /transactions`.
 * Third Party Vendor (FI-scoped) uses `GET /transactions/institution/{code}`
 * (backend also auto-routes role 4 to that path).
 */
export async function fetchTransactions({ institutionCode, requireInstitutionScope = false } = {}) {
  const code = String(institutionCode ?? "").trim();
  const scoped = requireInstitutionScope && !isGlobalInstitutionCode(code);
  if (requireInstitutionScope && !scoped) {
    throw new APIError("Institution code is required for this role.", 400, null);
  }
  if (scoped) {
    return fetchTransactionsByInstitution(code);
  }
  const [response, lookup] = await Promise.all([
    apiClient.get(API_ENDPOINTS.transactions.list),
    getInstitutionNameLookup(),
  ]);
  return normalizeTransactionCollection(response, lookup);
}

/**
 * Build query params for `GET /transactions/q/search` (align field names with your OpenAPI; mocks use the same keys).
 */
export function buildTransactionSearchParams({
  userInstitutionCode = "",
  startDate,
  endDate,
  page = 1,
  limit = 500,
  advanced = {},
} = {}) {
  const adv = advanced && typeof advanced === "object" ? advanced : {};
  const q = (v) => String(v ?? "").trim();
  const status = adv.status && adv.status !== "all" ? q(adv.status) : "";
  return {
    page: String(page),
    limit: String(limit),
    isCurrent: "true",
    userInstitutionCode: q(userInstitutionCode),
    startDate: formatDateTimeForApi(startDate),
    endDate: formatDateTimeForApi(endDate),
    sessionId: q(adv.sessionId),
    channelCode: q(adv.channel),
    srcInstitutionName: q(adv.sourceBank),
    destInstitutionName: q(adv.beneficiaryBank),
    responseCode: q(adv.responseCode),
    paymentReference: q(adv.paymentRef),
    minAmount: q(adv.minAmount),
    maxAmount: q(adv.maxAmount),
    statusText: status,
  };
}

export async function searchTransactions(params, { requireInstitutionScope = false } = {}) {
  const next = { ...(params && typeof params === "object" ? params : {}) };
  if (requireInstitutionScope && !String(next.userInstitutionCode || "").trim()) {
    throw new APIError("Institution code is required for this role.", 400, null);
  }
  const [response, lookup] = await Promise.all([
    apiClient.get(API_ENDPOINTS.transactions.search, next),
    getInstitutionNameLookup(),
  ]);
  return normalizeTransactionCollection(response, lookup);
}

export async function fetchTransactionDetails(sessionId) {
  if (!sessionId) {
    throw new APIError("Transaction session ID is required.", 400, null);
  }

  const lookup = await getInstitutionNameLookup();
  const primary = normalizeTransactionCollection(
    await apiClient.get(API_ENDPOINTS.transactions.details(sessionId)),
    lookup,
  );
  let row = primary[0] ?? null;
  if (!row) {
    try {
      const alt = await apiClient.get(API_ENDPOINTS.transactions.bySessionId(sessionId), {
        isCurrent: "true",
      });
      const secondary = normalizeTransactionCollection(alt, lookup);
      row = secondary[0] ?? null;
    } catch {
      /* optional OpenAPI path */
    }
  }
  return row;
}

/** `GET /transactions/institution/{code}` — when dates are present, use by-date (with meta aggregates). */
export async function fetchTransactionsByInstitution(institutionCode, params = {}) {
  if (!institutionCode) {
    throw new APIError("Institution code is required.", 400, null);
  }
  const hasDate = Boolean(params.startDate && params.endDate);
  const endpoint = hasDate
    ? API_ENDPOINTS.dashboards.transactionsByDateByInstitution(institutionCode)
    : API_ENDPOINTS.transactions.byInstitution(institutionCode);
  const [response, lookup] = await Promise.all([
    apiClient.get(endpoint, params),
    getInstitutionNameLookup(),
  ]);
  return normalizeTransactionCollection(response, lookup);
}

/**
 * `POST /transactions-by-session-ids` — batch lookup (body shape varies by deployment; we send ids in several common keys).
 */
export async function searchTransactionsBySessionIds(sessionIds, extraBody = {}) {
  const ids = Array.isArray(sessionIds)
    ? sessionIds.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!ids.length) {
    throw new APIError("At least one session id is required.", 400, null);
  }
  const csv = ids.join(",");
  const body = {
    ...extraBody,
    srcSessionid: csv,
    sessionIds: ids,
    records: JSON.stringify(ids),
  };
  const [response, lookup] = await Promise.all([
    apiClient.post(API_ENDPOINTS.transactions.bySessionIds, body),
    getInstitutionNameLookup(),
  ]);
  return normalizeTransactionCollection(response, lookup);
}

export async function fetchLiveTransactionFeed({ since, limit = 50, institution } = {}) {
  const params = { limit };
  if (since) params.since = since;
  if (institution) params.institution = institution;

  const [response, lookup] = await Promise.all([
    apiClient.get(API_ENDPOINTS.dashboards.liveFeed, params),
    getInstitutionNameLookup(),
  ]);

  const rows = normalizeTransactionCollection(response, lookup);
  const root = unwrapPayload(response);
  let meta = {};
  if (root && typeof root === "object" && root.meta != null) {
    try {
      meta = typeof root.meta === "string" ? JSON.parse(root.meta) : root.meta;
    } catch {
      meta = {};
    }
  }

  return { rows, meta };
}

export async function normalizeStreamTransaction(rawRow) {
  const lookup = await getInstitutionNameLookup();
  return normalizeTransaction(rawRow, 0, lookup);
}

export async function fetchLiveTransactions() {
  const transactions = await fetchTransactions();
  return transactions
    .sort((a, b) => getBackendDateTime(b.dateTime) - getBackendDateTime(a.dateTime))
    .slice(0, 100);
}

export async function fetchTransactionStatusChanges(params = {}) {
  const query = {
    startDate: formatDateTimeForApi(params.startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: formatDateTimeForApi(params.endDate ?? new Date()),
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    session_id: params.sessionId ?? "",
    requested_by: params.requestedBy ?? "",
    approved_by: params.approvedBy ?? "",
    current_status: params.currentStatus ?? "",
    new_status: params.newStatus ?? "",
    status: params.status ?? "",
  };

  const [response, lookup] = await Promise.all([
    apiClient.get(API_ENDPOINTS.transactions.pendingStatusUpdates, query),
    getInstitutionNameLookup(),
  ]);
  return normalizeTransactionCollection(response, lookup);
}

export async function requestTransactionStatusChange({
  transactionId,
  newStatus,
  reason,
  username = "",
  status = "",
}) {
  if (!transactionId || !newStatus || !reason) {
    throw new APIError("Transaction ID, new status, and reason are required.", 400, null);
  }

  const label = String(status || newStatus).trim();
  let responseCode = label;
  const lower = label.toLowerCase();
  if (lower === "successful" || lower === "success") responseCode = "00";
  else if (lower === "failed" || lower === "failure") responseCode = "91";
  else if (lower === "pending") responseCode = "09";

  const payload = {
    sessionid: transactionId,
    srcSessionid: transactionId,
    transactionId,
    username: String(username || "").trim(),
    // Backend reads the new code from srcResponsecode (narration is reason only).
    srcResponsecode: responseCode,
    destResponseCode: responseCode,
    status: responseCode,
    type: label,
    narration: reason,
    responseCodeDefinition: reason,
    records: JSON.stringify({
      requestedStatus: label,
      responseCode,
      reason,
    }),
  };

  return apiClient.post(API_ENDPOINTS.transactions.statusUpdate, payload);
}
