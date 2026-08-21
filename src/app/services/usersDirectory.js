import { API_ENDPOINTS, apiClient } from "./api";
import { isOtherUserRoleId, isSystemUserRoleId } from "../utils/roleAccess";

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of ["data", "records", "items", "results", "users", "content"]) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

function mapApiStatusToUi(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "approved" || s === "active") return "Active";
  if (s === "pending approval" || s === "pending") return "Pending Approval";
  if (s === "pending edit") return "Pending Edit";
  if (s === "pending delete") return "Pending Delete";
  if (s === "rejected" || s === "inactive") return "Inactive";
  return String(status || "Active").replace(/^\w/, (c) => c.toUpperCase());
}

function statusForPendingAction(actionType) {
  const t = String(actionType || "").trim().toLowerCase();
  if (t === "create") return "Pending Approval";
  if (t === "edit") return "Pending Edit";
  if (t === "delete") return "Pending Delete";
  return "Pending Approval";
}

function identityKey(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email) return `e:${email}`;
  const username = String(user?.username || "").trim().toLowerCase();
  if (username) return `u:${username}`;
  return `id:${String(user?.id || "")}`;
}

/**
 * Merge live directory users with pending ops from `*/get/actions`.
 * - create → synthetic row with Pending Approval
 * - edit/delete → overlay status on matching live user
 */
export function mergeUsersWithPendingActions(liveUsers, pendingActions = []) {
  const live = Array.isArray(liveUsers) ? liveUsers.map((u) => ({ ...u })) : [];
  const pending = Array.isArray(pendingActions) ? pendingActions : [];
  const byKey = new Map();
  for (const user of live) {
    byKey.set(identityKey(user), user);
  }

  const createRows = [];
  for (const raw of pending) {
    if (!raw || typeof raw !== "object") continue;
    const actionType = String(firstDefined(raw.actionType, raw.action_type, "")).trim().toLowerCase();
    if (!actionType) continue;
    const mapped = mapDirectoryUser({ ...raw, status: statusForPendingAction(actionType) });
    mapped.pendingAction = actionType;
    mapped.pendingId = String(firstDefined(raw.id, mapped.id));
    mapped.isPendingCreate = actionType === "create";

    if (actionType === "create") {
      mapped.id = `pending-create-${mapped.pendingId}`;
      createRows.push(mapped);
      continue;
    }

    const key = identityKey(mapped);
    const existing = byKey.get(key);
    if (existing) {
      existing.status = statusForPendingAction(actionType);
      existing.pendingAction = actionType;
      existing.pendingId = mapped.pendingId;
      existing.isPendingCreate = false;
    }
  }

  return [...live, ...createRows];
}

function normalizeRoleName(raw, fallback = "") {
  const r = String(raw || "").trim();
  if (!r) return fallback;
  const lower = r.toLowerCase();
  if (lower.includes("admin")) return "Admin";
  if (lower.includes("approver")) return "Approver";
  if (lower.includes("operator")) return "Operator";
  if (lower.includes("viewer")) return "Viewer";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * Maps `GET /users/get` / `GET /other-users/get` rows for admin user management UI.
 */
export function mapDirectoryUser(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const first = String(firstDefined(source.firstname, source.firstName, "") || "").trim();
  const last = String(firstDefined(source.surname, source.lastName, "") || "").trim();
  const combinedName = [first, last].filter(Boolean).join(" ").trim();
  const username = String(
    firstDefined(source.username, combinedName, source.email_address, source.email, `user_${index}`),
  ).trim();
  const roleIdCandidate = firstDefined(source.roleid, source.roleId, typeof source.role === "number" ? source.role : null);
  const roleId = roleIdCandidate != null && Number.isFinite(Number(roleIdCandidate)) ? Number(roleIdCandidate) : null;

  return {
    id: String(firstDefined(source.id, source.userId, `USR${index + 1}`)),
    username,
    email: String(firstDefined(source.email_address, source.email, "")).trim().toLowerCase(),
    phone: String(firstDefined(source.phone_number, source.phone, "")).trim(),
    roleId,
    roleName: normalizeRoleName(
      firstDefined(
        source.role_name,
        source.roleName,
        typeof source.role === "string" ? source.role : null,
      ),
      "",
    ),
    status: mapApiStatusToUi(firstDefined(source.status, "Approved")),
    institutionCode: String(
      firstDefined(source.financial_institution_code, source.institution, source.institutionid_as_string, ""),
    ).trim(),
    institutionName: String(
      firstDefined(source.institutionName, source.institution_name, source.financial_institution_name, ""),
    ).trim(),
    _raw: source,
  };
}

/** Directory list for admin screens (`GET /users/get`). */
export async function fetchUsersDirectory() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.users);
  const rows = unwrapArray(payload);
  return rows.map((row, index) => mapDirectoryUser(row, index)).filter((row) => isSystemUserRoleId(row.roleId));
}

/** Pending system-user ops (`GET /users/get/actions`). */
export async function fetchUsersPendingActions() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.userActions);
  return unwrapArray(payload);
}

/** Live system users merged with pending create/edit/delete. */
export async function fetchUsersDirectoryWithPending() {
  const [live, pending] = await Promise.all([
    fetchUsersDirectory().catch(() => []),
    fetchUsersPendingActions().catch(() => []),
  ]);
  return mergeUsersWithPendingActions(live, pending);
}

/** Directory list for other users (`GET /other-users/get`). */
export async function fetchOtherUsersDirectory() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.otherUsers);
  const rows = unwrapArray(payload);
  return rows.map((row, index) => mapDirectoryUser(row, index)).filter((row) => isOtherUserRoleId(row.roleId));
}

/** Pending other-user ops (`GET /other-users/get/actions`). */
export async function fetchOtherUsersPendingActions() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.otherUserActions);
  return unwrapArray(payload);
}

/** Live other users merged with pending create/edit/delete. */
export async function fetchOtherUsersDirectoryWithPending() {
  const [live, pending] = await Promise.all([
    fetchOtherUsersDirectory().catch(() => []),
    fetchOtherUsersPendingActions().catch(() => []),
  ]);
  return mergeUsersWithPendingActions(live, pending);
}

/**
 * Role catalog for forms (`GET /roles/get`).
 * Returns `[{ id, name }]` so callers can:
 *   - render `name` in a `<Select>` (UI)
 *   - submit `id` as the `roleid` integer the backend expects (avoids `roleid = 0`).
 */
export async function fetchRolesList({ minId, maxId } = {}) {
  const payload = await apiClient.get(API_ENDPOINTS.admin.roles);
  const rows = unwrapArray(payload);
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const rawName = String(
      firstDefined(r.role_name, r.roleName, r.name, r.role, r.label, r.description, "")
    ).trim();
    if (!rawName) continue;
    const idCandidate = firstDefined(r.id, r.roleId, r.roleid);
    const idNumber = idCandidate != null && Number.isFinite(Number(idCandidate)) ? Number(idCandidate) : null;
    if (idNumber == null) continue;
    if (minId != null && idNumber < minId) continue;
    if (maxId != null && idNumber > maxId) continue;
    if (seen.has(idNumber)) continue;
    seen.add(idNumber);
    out.push({ id: idNumber, name: normalizeRoleName(rawName, rawName) });
  }
  return out.sort((a, b) => a.id - b.id);
}

function mapEntityOptions(rows, idKeys, nameKeys) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = String(firstDefined(...idKeys.map((k) => row[k])) || "").trim();
    const name = String(firstDefined(...nameKeys.map((k) => row[k]), id) || id).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: name || id });
  }
  return out;
}

/**
 * Linked entity options for other-user create.
 * Roles 4-5: financial institutions. Roles 6-8: card merchants / terminal owners / PTSPs,
 * falling back to institutions if those lists fail on this environment.
 */
export async function fetchLinkedEntitiesForRole(roleId) {
  const { fetchInstitutionsList } = await import("./financialInstitutions");
  const institutions = async () => {
    const list = await fetchInstitutionsList({ activeOnly: true }).catch(() => []);
    return list.map((item) => ({ id: item.code, name: item.name || item.code }));
  };

  const tryCardList = async (path, idKeys, nameKeys) => {
    try {
      const payload = await apiClient.get(path);
      const mapped = mapEntityOptions(unwrapArray(payload), idKeys, nameKeys);
      if (mapped.length) return mapped;
    } catch {
      // Belema may not have the card schema; fall back to FIs.
    }
    return institutions();
  };

  if (roleId === 6) {
    return tryCardList(API_ENDPOINTS.admin.merchants, ["merchant_id", "merchantId"], ["merchant_name", "merchantName"]);
  }
  if (roleId === 7) {
    return tryCardList(
      API_ENDPOINTS.admin.terminalOwners,
      ["terminal_owner_id", "terminalOwnerId"],
      ["terminal_owner_name", "terminalOwnerName"],
    );
  }
  if (roleId === 8) {
    return tryCardList(API_ENDPOINTS.admin.ptsps, ["ptsp_id", "ptspId"], ["ptsp_name", "ptspName"]);
  }
  return institutions();
}

