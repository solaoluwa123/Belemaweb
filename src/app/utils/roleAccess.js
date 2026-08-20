/** Matches `tbl_role.id` on Belema / transgateweb_db. */
export const ROLE_IDS = {
  ADMINISTRATOR: 1,
  OPERATOR: 2,
  APPROVER: 3,
  THIRD_PARTY_VENDOR: 4,
  OTHER_MIN: 4,
  OTHER_MAX: 8,
};

export function isSystemUserRoleId(roleId) {
  const id = toRoleId(roleId);
  return id != null && id >= ROLE_IDS.ADMINISTRATOR && id <= ROLE_IDS.APPROVER;
}

export function isOtherUserRoleId(roleId) {
  const id = toRoleId(roleId);
  return id != null && id >= ROLE_IDS.OTHER_MIN && id <= ROLE_IDS.OTHER_MAX;
}

/** @deprecated Use ROLE_IDS.THIRD_PARTY_VENDOR */
export const THIRD_PARTY_VENDOR_ROLE_ID = ROLE_IDS.THIRD_PARTY_VENDOR;

export function toRoleId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roleName(user) {
  return String(user?.roleName || "").trim().toLowerCase();
}

export function isThirdPartyVendor(user) {
  if (!user) return false;
  const id = toRoleId(user.roleId ?? user.roleid);
  if (id === ROLE_IDS.THIRD_PARTY_VENDOR) return true;
  const name = roleName(user);
  return name.includes("third party") || name.includes("third-party");
}

/** API role 1 — Administrator: create users/wallets/FIs immediately (no maker-checker). */
export function isAdministrator(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  const id = toRoleId(user.roleId ?? user.roleid);
  if (id === ROLE_IDS.ADMINISTRATOR) return true;
  const r = roleName(user);
  if (!r) return false;
  if (r.includes("approver") && !r.includes("admin")) return false;
  return r === "admin" || r.includes("administrator") || r.includes("admin");
}

/** API role 2 — Operator: submits create/edit for approver review. */
export function isOperatorRole(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  const id = toRoleId(user.roleId ?? user.roleid);
  if (id === ROLE_IDS.OPERATOR) return true;
  const r = roleName(user);
  return r.includes("operator") || r.includes("maker");
}

/** API role 3 — Approver: approves pending operations. */
export function isApproverRole(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  const id = toRoleId(user.roleId ?? user.roleid);
  if (id === ROLE_IDS.APPROVER) return true;
  return roleName(user).includes("approver");
}

export function getInstitutionScope(user, override) {
  const code = String(override ?? user?.institutionCode ?? "").trim();
  if (isThirdPartyVendor(user)) {
    return code || null;
  }
  return code || null;
}

export function requiresInstitutionScope(user) {
  return isThirdPartyVendor(user);
}

export function canMutateWallets(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  return isAdministrator(user) || isOperatorRole(user);
}

export function canManageUsers(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  return isAdministrator(user) || isOperatorRole(user);
}

export function canManageFI(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  return isAdministrator(user) || isOperatorRole(user);
}

export function canLogSwitchDispute(user, { isOperator = false } = {}) {
  if (!user || isThirdPartyVendor(user)) return false;
  return isOperator || isAdministrator(user);
}

export function canApproveSwitchDispute(user) {
  if (!user || isThirdPartyVendor(user)) return false;
  return isApproverRole(user) || isAdministrator(user);
}

export function canRequestStatusChange(user) {
  if (!user) return false;
  return isThirdPartyVendor(user) || isAdministrator(user) || isOperatorRole(user);
}
