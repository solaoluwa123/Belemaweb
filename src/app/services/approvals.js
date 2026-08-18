import { APIError, API_ENDPOINTS, apiClient } from "./api";

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

function normalizeApprovalStatus(value) {
  const raw = String(value || "Pending").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("approve")) return "Approved";
  if (lower.includes("reject")) return "Rejected";
  if (lower.includes("pending")) return "Pending";
  return raw;
}

function normalizeApprovalItem(row, fallbackType = "Approval", index = 0) {
  const source = row && typeof row === "object" ? row : {};
  return {
    id: String(firstDefined(source.id, source.userId, source.walletId, source.institutionCode, `APR${index + 1}`)),
    type: String(firstDefined(source.type, fallbackType)),
    submittedBy: String(firstDefined(source.submittedBy, source.createdBy, source.username, source.email, "")),
    submittedDate: String(firstDefined(source.submittedDate, source.dateCreated, source.createdAt, "")),
    details: String(
      firstDefined(
        source.details,
        source.name,
        source.fullName,
        source.accountName,
        source.walletName,
        source.institutionName,
        source.description,
        source.email,
        ""
      )
    ),
    status: normalizeApprovalStatus(firstDefined(source.status, source.approvalStatus, "Pending")),
    amount: toNumber(firstDefined(source.amount, source.balance)),
    raw: source,
  };
}

/** Pending wallet operations from `GET /wallets/get/actions` — ids are `tbl_wallets_operations` rows. */
function normalizeWalletPendingOperation(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const actionType = String(firstDefined(source.actionType, source.actiontype, "")).trim();
  const walletName = String(firstDefined(source.walletname, source.walletName, "Wallet"));
  const walletNo = String(firstDefined(source.walletnumber, source.walletNumber, ""));
  const details = [walletName, walletNo && `#${walletNo}`, actionType && `(${actionType})`].filter(Boolean).join(" ");

  return {
    id: String(firstDefined(source.id, `WOP${index + 1}`)),
    type: "Wallet",
    submittedBy: String(firstDefined(source.creator, source.username, "")),
    submittedDate: String(firstDefined(source.date_created, source.dateCreated, source.createdAt, "")),
    details: details || "Wallet operation",
    status: "Pending",
    amount: toNumber(firstDefined(source.balance, source.amount)),
    raw: { ...source, actionType },
  };
}

/**
 * Wallet Approvals page is scoped to NEW wallet creation requests only.
 * Modifications to existing wallets (edit/delete/assign/credit/debit) belong to the
 * Change Requests Hub.
 */
const WALLET_PENDING_ACTIONS = new Set(["create"]);
const HIDDEN_USER_APPROVAL_IDS_KEY = "hidden_user_approval_ids_v1";
const HIDDEN_WALLET_APPROVAL_IDS_KEY = "hidden_wallet_approval_ids_v1";

function readHiddenUserApprovalIds() {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HIDDEN_USER_APPROVAL_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function rememberHiddenUserApprovalId(id) {
  if (!id || typeof sessionStorage === "undefined") return;
  try {
    const set = readHiddenUserApprovalIds();
    set.add(String(id));
    sessionStorage.setItem(HIDDEN_USER_APPROVAL_IDS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function readHiddenWalletApprovalIds() {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HIDDEN_WALLET_APPROVAL_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function writeHiddenWalletApprovalIds(set) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(HIDDEN_WALLET_APPROVAL_IDS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/** sessionStorage map: wallet approval id → { kind: "rejected" | "dismissed", reason?, decidedBy?, decidedAt? } */
const WALLET_APPROVAL_DECISIONS_KEY = "wallet_approval_decisions_v1";

function readWalletApprovalDecisions() {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WALLET_APPROVAL_DECISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeWalletApprovalDecisions(map) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(WALLET_APPROVAL_DECISIONS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Dismiss a wallet approval row from view for this session. Useful when the backend keeps
 * throwing 500 on a row with bad data (e.g. invalid wallettype FK) and reject is unsupported.
 */
export function dismissWalletApproval(id) {
  if (!id) return;
  const set = readHiddenWalletApprovalIds();
  set.add(String(id));
  writeHiddenWalletApprovalIds(set);
  // Record decision metadata so the dismissed view can distinguish dismiss vs reject.
  const decisions = readWalletApprovalDecisions();
  decisions[String(id)] = {
    kind: "dismissed",
    decidedAt: new Date().toISOString(),
  };
  writeWalletApprovalDecisions(decisions);
}

/**
 * Locally reject a wallet approval row. The backend has no reject path for wallet operations
 * (see docs/BACKEND_ENGINEER_HANDOFF.md §3.1), so this hides the row from the queue and stores
 * the rejection reason + approver identity in sessionStorage for audit visibility in the
 * dismissed view. Reversible via `restoreWalletApproval(id)`.
 */
export function rejectWalletApprovalLocally({ id, reason = "", reviewedBy = "" } = {}) {
  if (!id) return;
  const set = readHiddenWalletApprovalIds();
  set.add(String(id));
  writeHiddenWalletApprovalIds(set);
  const decisions = readWalletApprovalDecisions();
  decisions[String(id)] = {
    kind: "rejected",
    reason: String(reason || "").trim(),
    decidedBy: String(reviewedBy || "").trim(),
    decidedAt: new Date().toISOString(),
  };
  writeWalletApprovalDecisions(decisions);
}

/** Restore a previously dismissed/rejected wallet approval row so it shows up in the queue again. */
export function restoreWalletApproval(id) {
  if (!id) return;
  const set = readHiddenWalletApprovalIds();
  set.delete(String(id));
  writeHiddenWalletApprovalIds(set);
  const decisions = readWalletApprovalDecisions();
  if (decisions[String(id)]) {
    delete decisions[String(id)];
    writeWalletApprovalDecisions(decisions);
  }
}

/** Clear all dismissed/rejected wallet approval ids for this session. */
export function clearDismissedWalletApprovals() {
  writeHiddenWalletApprovalIds(new Set());
  writeWalletApprovalDecisions({});
}

/** Get the list of currently dismissed wallet approval ids (for showing the "dismissed" view). */
export function getDismissedWalletApprovalIds() {
  return [...readHiddenWalletApprovalIds()];
}

/** Get the recorded decision (kind/reason/decidedBy/decidedAt) for a given approval id. */
export function getWalletApprovalDecision(id) {
  if (!id) return null;
  const decisions = readWalletApprovalDecisions();
  return decisions[String(id)] || null;
}

export async function fetchUserApprovals() {
  // Pending system-user operations come from `/users/get/actions`.
  // Role-4 institution contacts also have a dedicated queue at `/contacts/get/actions`.
  const hiddenIds = readHiddenUserApprovalIds();
  const [usersResult, otherUsersResult, contactsResult] = await Promise.allSettled([
    apiClient.get(API_ENDPOINTS.approvals.userActions),
    apiClient.get(API_ENDPOINTS.approvals.otherUserActions),
    apiClient.get(API_ENDPOINTS.approvals.contactsUserActions),
  ]);
  const userRows = usersResult.status === "fulfilled" ? asArray(usersResult.value) : [];
  const otherUserRows = otherUsersResult.status === "fulfilled" ? asArray(otherUsersResult.value) : [];
  const contactRows =
    contactsResult.status === "fulfilled" ? asArray(contactsResult.value) : [];

  const taggedUsers = [...userRows, ...otherUserRows].map((row) => {
    const source = row && typeof row === "object" ? row : {};
    const roleId = Number(source.roleid ?? source.roleId ?? 0);
    const isContact = roleId === 4;
    const isOther = roleId >= 4 && roleId <= 8;
    return {
      ...source,
      __userSegment: isContact ? "contact" : isOther ? "other" : source.__userSegment || "system",
    };
  });

  const taggedContacts = contactRows.map((row) => {
    const source = row && typeof row === "object" ? row : {};
    return { ...source, __userSegment: "contact" };
  });

  const byId = new Map();
  for (const row of [...taggedUsers, ...taggedContacts]) {
    const id = String(row?.id ?? "");
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || row.__userSegment === "contact") {
      byId.set(id, row);
    }
  }

  return [...byId.values()]
    .map((row, index) => {
      const item = normalizeApprovalItem(row, "User", index);
      const isContact = row.__userSegment === "contact";
      return {
        ...item,
        isContactApproval: isContact,
        raw: { ...item.raw, __userSegment: row.__userSegment },
      };
    })
    .filter((row) => row.status === "Pending")
    .filter((row) => !hiddenIds.has(String(row.id)));
}

function isContactApprovalRequest({ isContactApproval, raw } = {}) {
  if (isContactApproval) return true;
  const roleId = Number(raw?.roleid ?? raw?.roleId ?? 0);
  return raw?.__userSegment === "contact" || roleId === 4;
}

export async function approveUserApproval({
  id,
  actionType,
  approverUsername,
  isContactApproval = false,
  institution = "",
  raw = null,
} = {}) {
  if (!id) throw new APIError("A user approval ID is required.", 400, null);
  const username = String(approverUsername || "").trim();
  if (!username) throw new APIError("Approver username is required.", 400, null);
  const type = String(actionType || "").trim().toLowerCase();
  if (!type) throw new APIError("User approval actionType is required.", 400, null);
  const contact =
    isContactApprovalRequest({ isContactApproval, raw }) ||
    Number(raw?.roleid ?? raw?.roleId ?? raw?.role ?? 0) === 4;
  const body = {
    id,
    actionType: type,
    username,
  };
  if (contact) {
    const institutionCode = String(
      institution || raw?.institution || raw?.financial_institution_code || ""
    ).trim();
    if (institutionCode) {
      body.institution = institutionCode;
    }
    const result = await apiClient.put(API_ENDPOINTS.approvals.approveContactUser, body);
    rememberHiddenUserApprovalId(id);
    return result;
  }
  const result = await apiClient.put(API_ENDPOINTS.approvals.approveUser, body);
  rememberHiddenUserApprovalId(id);
  return result;
}

export async function rejectUserApproval(id, { isContactApproval = false, email = "", raw = null } = {}) {
  if (!id) throw new APIError("A user approval ID is required.", 400, null);
  const contact = isContactApprovalRequest({ isContactApproval, raw });
  const contactEmail = String(email || raw?.email_address || raw?.email || raw?.username || "").trim();
  if (contact && contactEmail) {
    return apiClient.put(API_ENDPOINTS.approvals.rejectContact(id, contactEmail), {});
  }
  return apiClient.put(API_ENDPOINTS.approvals.rejectUser(id), {});
}

/**
 * Pending wallet operations (maker–checker queue), not the wallet catalog.
 * Backend: `GET /wallets/get/actions` → `tbl_wallets_operations`.
 */
/**
 * Fetch the wallet approvals queue.
 * @param {{ includeDismissed?: boolean, onlyDismissed?: boolean }} [options]
 *   - includeDismissed: also return rows the approver dismissed this session.
 *   - onlyDismissed: return ONLY rows the approver dismissed this session.
 *     Returned rows are tagged with `dismissed: true`.
 */
export async function fetchWalletApprovals(options = {}) {
  const { includeDismissed = false, onlyDismissed = false } = options;
  const payload = await apiClient.get(API_ENDPOINTS.approvals.walletActions);
  const hiddenIds = readHiddenWalletApprovalIds();
  const decisions = readWalletApprovalDecisions();
  const rows = asArray(payload);
  return rows
    .filter((row) => {
      const id = String(row?.id ?? "");
      const isDismissed = id && hiddenIds.has(id);
      if (onlyDismissed) {
        if (!isDismissed) return false;
      } else if (isDismissed && !includeDismissed) {
        return false;
      }
      const t = String(row?.actionType ?? row?.actiontype ?? "").trim().toLowerCase();
      return !t || WALLET_PENDING_ACTIONS.has(t);
    })
    .map((row, index) => {
      const item = normalizeWalletPendingOperation(row, index);
      const id = String(row?.id ?? "");
      const decision = id ? decisions[id] || null : null;
      return {
        ...item,
        dismissed: id ? hiddenIds.has(id) : false,
        decision,
      };
    });
}

/**
 * Apply a pending wallet operation. Backend `PUT /wallets/approval` expects:
 * `WalletModel`: id (operation id), actionType (e.g. create, edit), creator (approver username).
 *
 * The backend stores `actionType` in lowercase (`tbl_wallets_operations`) per the API contract,
 * so we send a normalized lowercase value. We intentionally do not retry on error — retrying can
 * trigger a duplicate approval after the first call already consumed the row.
 */
export async function approveWalletApproval({ id, actionType, creator }) {
  if (!id) throw new APIError("A wallet operation id is required.", 400, null);
  const opType = String(actionType || "").trim().toLowerCase();
  if (!opType) throw new APIError("Missing wallet operation actionType (e.g. create, edit).", 400, null);
  const who = String(creator || "").trim();
  if (!who) throw new APIError("Approver identity (creator) is required.", 400, null);
  const numericId = Number(id);
  const payloadId = Number.isFinite(numericId) ? numericId : id;

  return apiClient.put(API_ENDPOINTS.approvals.approveWallet, {
    id: payloadId,
    actionType: opType,
    creator: who,
  });
}

/**
 * Wallet reject is not implemented in `WalletsService.WalletApprovals` (no reject branch).
 * Backend must add behaviour or a dedicated endpoint before this can succeed.
 */
export async function rejectWalletApproval() {
  throw new APIError(
    "Wallet operation reject is not implemented on the API (no reject path in WalletApprovals). Ask backend to add it.",
    501,
    null
  );
}

export async function fetchInstitutionApprovals() {
  const payload = await apiClient.get(API_ENDPOINTS.approvals.institutions);
  return asArray(payload).map((row, index) => normalizeApprovalItem(row, "Institution", index));
}

export async function approveInstitutionApproval(id) {
  if (!id) throw new APIError("An institution approval ID is required.", 400, null);
  return apiClient.put(API_ENDPOINTS.approvals.approveInstitution, { id, institutionId: id, approvalStatus: "Approved" });
}

export async function rejectInstitutionApproval(id) {
  if (!id) {
    return apiClient.put(API_ENDPOINTS.approvals.rejectInstitution, { approvalStatus: "Rejected" });
  }
  return apiClient.put(API_ENDPOINTS.approvals.rejectInstitutionById(id), { id, approvalStatus: "Rejected" });
}

/** `GET /users/get/actions` — roles/institutions directory for user forms. */
export async function fetchUsersActionsDirectory() {
  return apiClient.get(API_ENDPOINTS.approvals.userActions);
}

/** `GET /wallets/get/actions` — institutions/options for wallet flows. */
export async function fetchWalletsActionsDirectory() {
  return apiClient.get(API_ENDPOINTS.approvals.walletActions);
}

/** `GET /financial-institutions/get/actions` — institution types + list for approvals context. */
export async function fetchInstitutionsActionsDirectory() {
  return apiClient.get(API_ENDPOINTS.approvals.institutionActions);
}
