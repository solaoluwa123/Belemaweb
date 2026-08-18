import { API_ENDPOINTS, apiClient, APIError } from "./api";
import { createDispute } from "./disputes";
import {
  approveInstitutionApproval,
  approveUserApproval,
  fetchInstitutionApprovals,
  fetchUserApprovals,
  rejectInstitutionApproval,
  rejectUserApproval,
} from "./approvals";
import { approveFundingRequest, rejectFundingRequest } from "./wallets";

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of ["data", "records", "items", "results"]) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

/**
 * Change Requests Hub is the UNIFIED queue of every request awaiting approver action —
 * wallet creates / edits / deletes / assigns / funding (credit, debit), pending system
 * user operations, and pending institution registrations. The individual approval pages
 * (Wallet Approvals, Pending User Approvals, Institution Approvals) continue to provide
 * focused views, but every row that needs an approver decision also appears here.
 */
const WALLET_OP_ACTIONS = new Set(["create", "edit", "delete", "assign", "credit", "debit"]);
const HIDDEN_WALLET_OP_IDS_KEY = "hidden_wallet_change_request_ids_v1";

function readHiddenWalletOpIds() {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HIDDEN_WALLET_OP_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function rememberHiddenWalletOpId(id) {
  if (!id || typeof sessionStorage === "undefined") return;
  try {
    const set = readHiddenWalletOpIds();
    set.add(String(id));
    sessionStorage.setItem(HIDDEN_WALLET_OP_IDS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/** `String(undefined)` produces "undefined" — guard so it doesn't leak into UI/date parsers. */
function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

/** Map a `tbl_wallets_operations` row into the shape the change-requests hub expects. */
function walletOpToChangeRequest(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const actionType = safeString(source.actionType ?? source.actiontype).trim().toLowerCase();
  const walletName = safeString(source.walletname ?? source.walletName, "Wallet");
  const walletNo = safeString(source.walletnumber ?? source.walletNumber);
  const institution = safeString(
    source.financialInstitutionName ??
      source.financial_institution_name ??
      source.financialInstitutionCode
  );
  const verb = actionType ? `Wallet ${actionType}` : "Wallet operation";
  const summaryParts = [
    verb,
    walletName,
    walletNo ? `#${walletNo}` : "",
    institution ? `(${institution})` : "",
  ].filter(Boolean);

  const id = safeString(source.id, `WOP${index + 1}`);
  return {
    id,
    rowKey: `wallet:${id}`,
    resourceType: actionType ? `wallet.${actionType}` : CHANGE_RESOURCE_TYPES.WALLET_EDIT,
    summary: summaryParts.join(" "),
    requestedBy: safeString(source.creator ?? source.username),
    status: "Pending",
    createdAt: safeString(
      source.date_created ??
        source.dateCreated ??
        source.createdAt ??
        source.creationdate
    ),
    payload: {
      walletId: source.id,
      walletnumber: walletNo,
      walletname: walletName,
      financialInstitutionCode: source.financialInstitutionCode,
      financialInstitutionName: source.financialInstitutionName,
      balance: source.balance,
      assignee: source.assignee,
      note: source.note,
      actionType,
    },
    raw: { ...source, actionType },
  };
}

/**
 * Map a pending `tbl_user_details_operations` row (as returned by `fetchUserApprovals`,
 * shape `{ id, submittedBy, submittedDate, details, raw, ... }`) into the unified
 * change-request shape.
 */
function userApprovalToChangeRequest(row) {
  const raw = row?.raw && typeof row.raw === "object" ? row.raw : {};
  const userSegment = safeString(raw.__userSegment ?? row?.userSegment, "system");
  const isContactApproval = userSegment === "contact" || Boolean(row?.isContactApproval);
  const actionType =
    safeString(raw.actionType ?? raw.actiontype).trim().toLowerCase() || "update";
  const userIdentity = safeString(
    raw.username ??
      raw.email_address ??
      raw.emailAddress ??
      raw.email ??
      row?.details,
    "User",
  );
  const role = safeString(raw.role ?? raw.role_name ?? raw.roleName);
  const segmentLabel =
    userSegment === "contact"
      ? "Contact"
      : userSegment === "other"
        ? "Other user"
        : "System user";
  const summaryParts = [
    `${segmentLabel} ${actionType}`,
    userIdentity,
    role ? `(${role})` : "",
  ].filter(Boolean);
  const id = safeString(row?.id ?? raw.id, `USR-${userIdentity}`);
  return {
    id,
    rowKey: `user:${id}`,
    resourceType:
      actionType === "create"
        ? CHANGE_RESOURCE_TYPES.SYSTEM_USER_CREATE
        : actionType === "delete"
          ? CHANGE_RESOURCE_TYPES.SYSTEM_USER_DELETE
          : CHANGE_RESOURCE_TYPES.SYSTEM_USER_UPDATE,
    summary: summaryParts.join(" "),
    requestedBy: safeString(
      row?.submittedBy ?? raw.creator ?? raw.created_by ?? raw.createdBy,
    ),
    status: "Pending",
    createdAt: safeString(
      row?.submittedDate ??
        raw.date_created ??
        raw.dateCreated ??
        raw.createdAt,
    ),
    payload: {
      id: row?.id ?? raw.id,
      actionType,
      username: userIdentity,
      role,
      userSegment,
      isContactApproval,
    },
    raw: { ...raw, actionType, __userSegment: userSegment },
  };
}

/**
 * Map a pending institution registration (as returned by `fetchInstitutionApprovals`,
 * shape `{ id, submittedBy, submittedDate, details, raw, ... }`) into the unified
 * change-request shape.
 */
function institutionApprovalToChangeRequest(row) {
  const raw = row?.raw && typeof row.raw === "object" ? row.raw : {};
  const name = safeString(
    raw.name ?? raw.shortName ?? raw.short_name ?? row?.details,
    "Institution",
  );
  const code = safeString(raw.code ?? raw.shortName ?? raw.short_name);
  const actionType =
    safeString(raw.actionType ?? raw.actiontype, "create").trim().toLowerCase() || "create";
  const summaryParts = [
    `Institution ${actionType}`,
    name,
    code ? `(${code})` : "",
  ].filter(Boolean);
  const id = safeString(row?.id ?? raw.id, `INST-${code || name}`);
  return {
    id,
    rowKey: `institution:${id}`,
    resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_REGISTRATION_DECISION,
    summary: summaryParts.join(" "),
    requestedBy: safeString(
      row?.submittedBy ?? raw.created_by ?? raw.createdBy ?? raw.creator,
    ),
    status: "Pending",
    createdAt: safeString(
      row?.submittedDate ??
        raw.date_created ??
        raw.dateCreated ??
        raw.createdAt,
    ),
    payload: {
      id: row?.id ?? raw.id,
      name,
      code,
      actionType,
    },
    raw,
  };
}

/**
 * Submit a maker request. Operators and admins use this; approvers apply via the hub.
 * @param {{ resourceType: string, summary: string, payload: object, requestedBy: string }} body
 */
export async function submitChangeRequest({ resourceType, summary, payload, requestedBy }) {
  if (!resourceType || !requestedBy) {
    throw new APIError("resourceType and requestedBy are required.", 400, null);
  }
  const direct = await submitDirectResourceAction({
    resourceType: String(resourceType).trim(),
    payload: payload && typeof payload === "object" ? payload : {},
    requestedBy: String(requestedBy).trim(),
  });
  if (direct !== undefined) return direct;
  return apiClient.post(API_ENDPOINTS.changeRequests.submit, {
    resourceType: String(resourceType).trim(),
    summary: String(summary || "").trim() || resourceType,
    payload: payload && typeof payload === "object" ? payload : {},
    requestedBy: String(requestedBy).trim(),
  });
}

function splitFullName(fullName, email = "") {
  const n = String(fullName || "").trim();
  if (n.includes(" ")) {
    const [first, ...rest] = n.split(/\s+/);
    return { firstname: first, surname: rest.join(" ") || "." };
  }
  const local = String(email || "").split("@")[0] || "contact";
  return { firstname: n || local, surname: "." };
}

function normalizeWalletStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "inactive") return "Inactive";
  if (s === "active") return "Active";
  return status || "Active";
}

/** Coerce to a finite integer or fall back to `fallback` (matches the `integer` schema fields). */
function toIntOr(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Coerce to a finite float. Do not parse display strings like "7.5%". */
function toFloatOr(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" && value.includes("%")) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringOr(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Build the `InstitutionModel` body for `PUT /financial-institutions` (create) and
 * `POST /financial-institutions` (edit).
 *
 * The backend's `FinancialInstitutionsService` calls `GetUserRole(created_by, sessiontoken)`
 * to authorise the call — omitting `created_by` makes that lookup return `-100` and the
 * server responds 401. Numeric fields must not be strings: `id`, `businessType`,
 * `port_number`, and `isProcessTSQ` are integers; `vat` and `charge_amount` are floats.
 *
 * We therefore:
 *   - copy `raw` first so unknown fields round-trip,
 *   - overlay the canonical column names the backend expects (`name`, `business_address`,
 *     `port_number`, …) from any of the camelCase variants the form may pass,
 *   - stamp the caller identity into `created_by` / `createdBy`,
 *   - coerce numeric fields (do not treat a "7.5%" display string as vat).
 */
function buildInstitutionWritePayload(payload, requestedBy, actionType) {
  const raw =
    payload && typeof payload === "object" && payload.raw && typeof payload.raw === "object"
      ? payload.raw
      : {};
  const p = payload && typeof payload === "object" ? payload : {};
  const caller = toStringOr(requestedBy).trim();

  const name = toStringOr(p.name ?? p.financialInstitutionName ?? p.businessName ?? raw.name);
  const code = toStringOr(p.code ?? raw.code);
  const shortName = toStringOr(p.shortName ?? raw.shortName ?? name);
  const businessAddress = toStringOr(
    p.business_address ?? p.businessAddress ?? p.address ?? raw.business_address,
  );
  const businessTypeName = toStringOr(
    p.businessTypeName ?? p.institutionType ?? p.type ?? raw.businessTypeName,
  );
  const status = toStringOr(p.status ?? p.adminStatus ?? raw.status, "Pending");

  const body = {
    ...raw,
    id: toIntOr(p.id ?? raw.id, 0),
    businessType: toIntOr(p.businessType ?? raw.businessType, 0),
    port_number: toIntOr(p.port_number ?? p.portNumber ?? raw.port_number, 0),
    isProcessTSQ: toIntOr(p.isProcessTSQ ?? raw.isProcessTSQ, 0),
    issettlementbank: toIntOr(p.issettlementbank ?? raw.issettlementbank, 0),
    enableInward: toIntOr(p.enableInward ?? raw.enableInward, 0),
    neTimeout: toIntOr(p.neTimeout ?? raw.neTimeout, 5),
    ftTimeout: toIntOr(p.ftTimeout ?? raw.ftTimeout, 10),
    wallettype: toIntOr(p.wallettype ?? raw.wallettype, 0),
    vat: toFloatOr(p.vat ?? raw.vat, 0),
    charge_amount: toFloatOr(p.charge_amount ?? p.chargeAmount ?? raw.charge_amount, 0),

    name,
    shortName,
    code,
    color: toStringOr(p.color ?? raw.color),
    business_address: businessAddress,
    businessTypeName,
    note: toStringOr(p.note ?? raw.note),
    status,
    publickeylocation: toStringOr(p.publickeylocation ?? raw.publickeylocation),
    cbn_bank_account: toStringOr(p.cbn_bank_account ?? p.cbnBankAccount ?? raw.cbn_bank_account),
    switch_code: toStringOr(p.switch_code ?? p.switchCode ?? raw.switch_code),
    publickeylocationLinux: toStringOr(
      p.publickeylocationLinux ?? raw.publickeylocationLinux,
    ),
    password: toStringOr(p.password ?? raw.password),
    hashKey: toStringOr(p.hashKey ?? raw.hashKey),
    serverIP: toStringOr(p.serverIP ?? raw.serverIP, "localhost"),
    url: toStringOr(p.url ?? raw.url),
    urlTSQ: toStringOr(p.urlTSQ ?? raw.urlTSQ),
    neEnvelope: toStringOr(p.neEnvelope ?? raw.neEnvelope),
    neResponseStartTag: toStringOr(p.neResponseStartTag ?? raw.neResponseStartTag),
    neResponseEndTag: toStringOr(p.neResponseEndTag ?? raw.neResponseEndTag),
    ftEnvelope: toStringOr(p.ftEnvelope ?? raw.ftEnvelope),
    ftResponseStartTag: toStringOr(p.ftResponseStartTag ?? raw.ftResponseStartTag),
    ftResponseEndTag: toStringOr(p.ftResponseEndTag ?? raw.ftResponseEndTag),
    tsqEnvelope: toStringOr(p.tsqEnvelope ?? raw.tsqEnvelope),
    tsqResponseStartTag: toStringOr(p.tsqResponseStartTag ?? raw.tsqResponseStartTag),
    tsqResponseEndTag: toStringOr(p.tsqResponseEndTag ?? raw.tsqResponseEndTag),
    walletname: toStringOr(p.walletname ?? raw.walletname),
    date_created: toStringOr(p.date_created ?? raw.date_created),
    date_updated: toStringOr(p.date_updated ?? raw.date_updated),

    // Authorization-critical: the controller uses these to resolve the caller's role.
    created_by: caller,
    createdBy: caller,

    actionType: toStringOr(actionType, "create"),
  };

  if (actionType === "edit" || actionType === "deactivate") {
    delete body.password;
    delete body.hashKey;
    delete body.walletname;
    delete body.wallettype;
  }

  return body;
}

/**
 * Routes known request types to real OpenAPI endpoints (no maker-checker backend required).
 * Returns `undefined` for unknown types so caller can use `/change-requests/submit` if available.
 */
async function submitDirectResourceAction({ resourceType, payload, requestedBy }) {
  switch (resourceType) {
    case CHANGE_RESOURCE_TYPES.WALLET_CREATE:
      return apiClient.put(API_ENDPOINTS.wallets.create, payload);

    case CHANGE_RESOURCE_TYPES.WALLET_EDIT:
      return apiClient.post(API_ENDPOINTS.wallets.edit, {
        id: payload.walletId ?? payload.id,
        walletnumber: payload.walletnumber || payload.accountNumber || "",
        walletname: payload.walletname || payload.accountName || "",
      });

    case CHANGE_RESOURCE_TYPES.WALLET_STATUS:
      return apiClient.put(API_ENDPOINTS.wallets.status, {
        walletId: payload.walletId ?? payload.id,
        accountNumber: payload.accountNumber || payload.walletnumber || "",
        status: normalizeWalletStatus(payload.status),
      });

    case CHANGE_RESOURCE_TYPES.WALLET_DELETE:
      return apiClient.post(API_ENDPOINTS.wallets.bulkDelete, {
        ids: Array.isArray(payload.ids) ? payload.ids : [payload.id].filter(Boolean),
      });

    case CHANGE_RESOURCE_TYPES.DISPUTE_CREATE:
      // Delegate to the dedicated helper so the full transaction-shaped body
      // (with all source / destination fields) is built consistently. Sending a
      // partial body produces 500s because `tbl_disputes` has many NOT NULL
      // columns the controller copies from the original transaction.
      return createDispute({
        transactionId: payload.transactionId || payload.srcSessionid,
        disputeType: payload.type || payload.disputeType,
        reason: payload.narration || payload.reason,
        amount: payload.srcAmount ?? payload.amount,
        description: payload.records || payload.description,
        submittedBy: payload.submittedBy || payload.username || payload.loggedBy,
        loggingInstitution: payload.loggingInstitution || payload.srcInstitutioncode || "",
        transaction: payload.transaction || null,
      });

    case CHANGE_RESOURCE_TYPES.INSTITUTION_CREATE:
      return apiClient.put(
        API_ENDPOINTS.admin.createInstitution,
        buildInstitutionWritePayload(payload, requestedBy, "create"),
      );

    case CHANGE_RESOURCE_TYPES.INSTITUTION_UPDATE:
      return apiClient.post(
        API_ENDPOINTS.admin.editInstitution,
        buildInstitutionWritePayload(payload, requestedBy, "edit"),
      );

    case CHANGE_RESOURCE_TYPES.INSTITUTION_DEACTIVATE:
      return apiClient.post(
        API_ENDPOINTS.admin.editInstitution,
        buildInstitutionWritePayload(
          { ...payload, status: "Inactive" },
          requestedBy,
          "deactivate",
        ),
      );

    case CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_CREATE: {
      const { firstname, surname } = splitFullName(payload.fullName, payload.email);
      // The backend's `CreateContact` controller deserialises the body as a `UserModel`
      // and pulls exactly these 7 fields (verified against the bytecode):
      //   role         — *caller's email/username* (used for `GetUserRole(role, sessiontoken)`)
      //   institution  — the institution code (NOT `financial_institution_code`)
      //   firstname, surname, phone_number, email_address
      //   security     — password seeded for the contact's nested user account
      // Missing any of these (especially `role`, `institution`, or `security`) causes the
      // nested `UsersInterface.Create` call to fail and the handler returns 500.
      const caller = String(requestedBy || "").trim();
      if (!caller) {
        throw new APIError(
          "Caller identity is required to create a contact (the backend reads it from the `role` field).",
          400,
          payload,
        );
      }
      const institutionCode = String(payload.institutionCode || "").trim();
      if (!institutionCode) {
        throw new APIError("Institution code is required to create a contact.", 400, payload);
      }
      const password = String(payload.password || "").trim();
      if (!password) {
        throw new APIError("Password is required to create a contact.", 400, payload);
      }
      const body = {
        role: caller,
        username: caller,
        created_by: caller,
        institution: institutionCode,
        firstname,
        surname,
        phone_number: payload.mobile || "",
        email_address: payload.email,
        security: password,

        // Compatibility fields — harmless duplicates the older shape sent. The
        // backend ignores any field it doesn't read off `UserModel`, so leaving
        // them in keeps logs/diagnostics easier to correlate.
        fullName: payload.fullName,
        mobile: payload.mobile || "",
        institutionCode,
        financial_institution_code: institutionCode,
      };
      if (typeof console !== "undefined") {
        // Don't log `security` — it's the contact's seeded password.
        const { security: _omit, ...safeBody } = body;
        console.debug("[contacts] PUT /financial-institutions/contacts body:", safeBody);
      }
      try {
        return await apiClient.put(API_ENDPOINTS.admin.createContact, body);
      } catch (err) {
        if (typeof console !== "undefined" && err instanceof APIError) {
          console.error("[contacts] backend rejected contact create:", {
            status: err.status,
            message: err.message,
            data: err.data,
          });
        }
        throw err;
      }
    }

    case CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_UPDATE: {
      const { firstname, surname } = splitFullName(payload.fullName, payload.email);
      const caller = String(requestedBy || "").trim();
      const institutionCode = String(payload.institutionCode || "").trim();
      return apiClient.post(API_ENDPOINTS.admin.editContact, {
        id: payload.contactId ?? payload.id,
        role: caller,
        username: caller,
        created_by: caller,
        institution: institutionCode,
        firstname,
        surname,
        phone_number: payload.mobile || "",
        email_address: payload.email,

        fullName: payload.fullName,
        mobile: payload.mobile || "",
        institutionCode,
        financial_institution_code: institutionCode,
      });
    }

    case CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_DELETE: {
      const email = String(payload.email || "").trim();
      if (!email) {
        throw new APIError("Contact email is required for delete.", 400, payload);
      }
      const endpoint = API_ENDPOINTS.admin.deleteContact(email, requestedBy || "system");
      return apiClient.delete(endpoint);
    }

    case CHANGE_RESOURCE_TYPES.TRANSACTION_STATUS_DECISION: {
      const sessionId = String(payload.sessionId || "").trim();
      const targetStatus = String(payload.targetStatus || "").trim();
      const reason = String(payload.reason || "").trim();
      if (!sessionId || !targetStatus || !reason) {
        throw new APIError("sessionId, targetStatus, and reason are required.", 400, payload);
      }
      return apiClient.post(API_ENDPOINTS.transactions.statusUpdate, {
        srcSessionid: sessionId,
        transactionId: sessionId,
        type: targetStatus,
        narration: reason,
        responseCodeDefinition: reason,
        records: JSON.stringify({ requestedStatus: targetStatus, reason }),
      });
    }

    case CHANGE_RESOURCE_TYPES.INSTITUTION_REGISTRATION_DECISION: {
      const code = String(payload.institutionCode || "").trim();
      const decision = String(payload.decision || "").toLowerCase();
      const caller = String(payload.requestedBy || payload.created_by || "").trim();
      if (!code || !decision) {
        throw new APIError("institutionCode and decision are required.", 400, payload);
      }
      // The backend's `FinancialInstitutionsService` calls `GetUserRole(created_by, sessiontoken)`,
      // so the body must carry the caller's identity or the request comes back 401.
      const desiredStatus = decision === "reject" ? "Rejected" : "Approved";
      const body = {
        ...(payload.raw && typeof payload.raw === "object" ? payload.raw : {}),
        id: code,
        institutionId: code,
        institutionCode: code,
        code,
        created_by: caller,
        createdBy: caller,
        actionType: decision === "reject" ? "reject" : "approve",
        status: desiredStatus,
        approvalStatus: desiredStatus,
      };
      const endpoint =
        decision === "approve"
          ? API_ENDPOINTS.approvals.approveInstitution
          : API_ENDPOINTS.approvals.rejectInstitution;
      return apiClient.put(endpoint, body);
    }

    default:
      return undefined;
  }
}

/**
 * Unified change-requests queue. Aggregates every record that needs an approver decision
 * from three backend sources, then applies optional client-side filters.
 *
 *  1. `GET /wallets/get/actions`         → wallet create/edit/delete/assign/credit/debit
 *  2. `fetchUserApprovals()`             → pending users (system + contact + other roles)
 *  3. `GET /financial-institutions`      → institutions still awaiting registration approval
 *
 * Each upstream source has its own normalizer (see *ToChangeRequest helpers); any source
 * that fails is logged and skipped so a single backend issue doesn't blank the entire hub.
 */
export async function fetchChangeRequests({ status, requester } = {}) {
  const settled = await Promise.allSettled([
    apiClient.get(API_ENDPOINTS.approvals.walletActions),
    fetchUserApprovals().catch((err) => {
      console.warn("[changeRequests] user approvals fetch failed:", err);
      return [];
    }),
    fetchInstitutionApprovals().catch((err) => {
      console.warn("[changeRequests] institution approvals fetch failed:", err);
      return [];
    }),
  ]);

  const merged = [];

  if (settled[0].status === "fulfilled") {
    const hiddenIds = readHiddenWalletOpIds();
    const walletRows = unwrapList(settled[0].value).filter((row) => {
      const id = String(row?.id ?? "");
      if (id && hiddenIds.has(id)) return false;
      const t = String(row?.actionType ?? row?.actiontype ?? "").trim().toLowerCase();
      return !t || WALLET_OP_ACTIONS.has(t);
    });
    walletRows.forEach((row, index) => merged.push(walletOpToChangeRequest(row, index)));
  } else {
    console.warn("[changeRequests] wallet actions fetch failed:", settled[0].reason);
  }

  if (settled[1].status === "fulfilled") {
    (settled[1].value || []).forEach((row) => merged.push(userApprovalToChangeRequest(row)));
  }

  if (settled[2].status === "fulfilled") {
    (settled[2].value || []).forEach((row) =>
      merged.push(institutionApprovalToChangeRequest(row)),
    );
  }

  let mapped = merged;
  if (status) {
    const wanted = String(status).trim().toLowerCase();
    mapped = mapped.filter((r) => r.status.toLowerCase() === wanted);
  }
  if (requester) {
    const who = String(requester).trim().toLowerCase();
    mapped = mapped.filter((r) => r.requestedBy.toLowerCase() === who);
  }
  return mapped;
}

function resourceKind(resourceType) {
  const s = String(resourceType || "").toLowerCase();
  if (s.startsWith("wallet.")) return "wallet";
  if (s.startsWith("systemuser.") || s.startsWith("user.")) return "user";
  if (s.startsWith("institution.")) return "institution";
  return "other";
}

/**
 * Approve a queued change. Dispatches to the right backend endpoint based on the row's
 * `resourceType` so a single Change Requests Hub can drive every approval flow.
 */
export async function approveChangeRequest({ id, approvedBy, note: _note = "", row } = {}) {
  if (!id || !approvedBy) {
    throw new APIError("Request id and approver identity are required.", 400, null);
  }
  const approver = String(approvedBy).trim();
  const kind = resourceKind(row?.resourceType);

  if (kind === "wallet") {
    const actionType = String(row?.raw?.actionType ?? row?.payload?.actionType ?? "")
      .trim()
      .toLowerCase();
    if (!actionType) {
      throw new APIError("Missing wallet operation actionType (e.g. create, edit).", 400, row || null);
    }
    // Funding credit/debit must use the dedicated funding endpoints (writes tbl_wallet_funding_approvals).
    if (actionType === "credit" || actionType === "debit") {
      const result = await approveFundingRequest({
        row,
        id,
        approvedBy: approver,
        actionType,
        note: _note,
      });
      rememberHiddenWalletOpId(id);
      return result;
    }
    const numericId = Number(id);
    const payloadId = Number.isFinite(numericId) ? numericId : id;
    const result = await apiClient.put(API_ENDPOINTS.approvals.approveWallet, {
      id: payloadId,
      actionType,
      creator: approver,
    });
    rememberHiddenWalletOpId(id);
    return result;
  }

  if (kind === "user") {
    const actionType = String(row?.raw?.actionType ?? row?.payload?.actionType ?? "")
      .trim()
      .toLowerCase() || "update";
    const isContactApproval =
      row?.raw?.__userSegment === "contact" || Boolean(row?.payload?.isContactApproval);
    return approveUserApproval({
      id,
      actionType,
      approverUsername: approver,
      isContactApproval,
      institution:
        row?.raw?.institution ??
        row?.raw?.financial_institution_code ??
        row?.payload?.institution,
      raw: row?.raw,
    });
  }

  if (kind === "institution") {
    return approveInstitutionApproval(row, approver);
  }

  throw new APIError(
    `Unknown change-request resource type: ${row?.resourceType || "unknown"}`,
    400,
    row || null,
  );
}

/**
 * Reject a queued change. Funding credit/debit uses reject-funding; other wallet ops
 * still lack a generic reject path on the API.
 */
export async function rejectChangeRequest({ id, reviewedBy, note: _note = "", row } = {}) {
  if (!id) {
    throw new APIError("Request id is required to reject.", 400, null);
  }
  const reviewer = String(reviewedBy || "").trim();
  const kind = resourceKind(row?.resourceType);

  if (kind === "wallet") {
    const actionType = String(row?.raw?.actionType ?? row?.payload?.actionType ?? "")
      .trim()
      .toLowerCase();
    if (actionType === "credit" || actionType === "debit") {
      if (!reviewer) {
        throw new APIError("Reviewer identity is required to reject funding requests.", 400, row || null);
      }
      if (!String(_note || "").trim()) {
        throw new APIError("Rejection reason is required for funding requests.", 400, row || null);
      }
      const result = await rejectFundingRequest({
        row,
        id,
        reviewedBy: reviewer,
        actionType,
        note: _note,
      });
      rememberHiddenWalletOpId(id);
      return result;
    }
    throw new APIError(
      "Reject is not implemented on the API for this wallet change request type yet.",
      501,
      row || null,
    );
  }

  if (kind === "user") {
    const isContactApproval =
      row?.raw?.__userSegment === "contact" || Boolean(row?.payload?.isContactApproval);
    return rejectUserApproval(id, {
      isContactApproval,
      email:
        row?.raw?.email_address ??
        row?.raw?.email ??
        row?.raw?.username ??
        row?.payload?.username,
      raw: row?.raw,
    });
  }

  if (kind === "institution") {
    if (!reviewer) {
      throw new APIError("Reviewer identity is required to reject institution registrations.", 400, row || null);
    }
    return rejectInstitutionApproval(row, reviewer);
  }

  throw new APIError(
    "Reject is not implemented on the API for wallet change requests yet. Ask backend to add a reject path.",
    501,
    row || null,
  );
}

/** Resource types used by the UI (maker–checker). */
export const CHANGE_RESOURCE_TYPES = {
  WALLET_CREATE: "wallet.create",
  WALLET_EDIT: "wallet.edit",
  WALLET_STATUS: "wallet.status",
  WALLET_DELETE: "wallet.delete",
  DISPUTE_CREATE: "dispute.create",
  SYSTEM_USER_CREATE: "systemUser.create",
  SYSTEM_USER_UPDATE: "systemUser.update",
  SYSTEM_USER_DELETE: "systemUser.delete",
  INSTITUTION_CREATE: "institution.create",
  INSTITUTION_UPDATE: "institution.update",
  INSTITUTION_DEACTIVATE: "institution.deactivate",
  INSTITUTION_REGISTRATION_DECISION: "institution.registrationDecision",
  INSTITUTION_CONTACT_CREATE: "institutionContact.create",
  INSTITUTION_CONTACT_UPDATE: "institutionContact.update",
  INSTITUTION_CONTACT_DELETE: "institutionContact.delete",
  TRANSACTION_STATUS_DECISION: "transaction.statusDecision",
};
