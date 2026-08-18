import { API_ENDPOINTS, APIError, apiClient } from "./api";

function mapUiStatusToApi(uiStatus) {
  const u = String(uiStatus || "Active");
  if (u === "Active") return "Approved";
  if (u === "Inactive") return "Inactive";
  if (u === "Pending") return "Pending";
  return u;
}

function splitName(username, email) {
  const u = String(username || "").trim();
  if (u.includes(" ")) {
    const [a, ...rest] = u.split(/\s+/);
    return { firstname: a, surname: rest.join(" ") || "." };
  }
  const local = String(email || "").split("@")[0] || "user";
  return { firstname: u || local, surname: "." };
}

function toRoleId(value) {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * `PUT /users/create` (or `/other-users/create`) with `UserModel`.
 *
 * IMPORTANT — backend contract (verified against `UsersController.Create` and
 * `UsersService.Create`):
 *   - The controller passes `user.getRole()` (the JSON `role` field) into the service as the
 *     **`creator`** parameter, which then runs
 *       `SELECT role FROM tbl_user_details WHERE (email_address = ? OR username = ?) AND deleted = 0 AND session_token = ?`
 *     So the body's `role` MUST be the *logged-in admin's email or username*. The session token
 *     in the `auth-token` header has to be that same admin's session.
 *   - The new user's role is taken from `user.getRoleid()` (the JSON `roleid` int).
 *
 * That means the request body needs:
 *   - `role`   = creator's email/username (NOT a role-name string like "Operator")
 *   - `roleid` = numeric role id of the new user
 *
 * @param {{
 *   username: string,
 *   email: string,
 *   password: string,
 *   phone?: string,
 *   roleName?: string,   // Display only — not sent.
 *   roleId?: number,     // Required: written into tbl_user_details.role
 *   status?: string,
 *   creator?: string,    // Required: logged-in admin's email/username — used by backend lookup
 * }} payload
 * @param {{ creator?: string, institutionCode?: string, institutionName?: string } & Record<string, unknown>} [context]
 */
export async function createUserWithApi(
  { username, email, password, phone, roleId, status, creator },
  context = {}
) {
  if (!username?.trim() || !email?.trim() || !password) {
    throw new APIError("Username, email, and password are required.", 400, null);
  }
  const numericRoleId = toRoleId(roleId);
  if (numericRoleId === undefined) {
    throw new APIError(
      "A numeric roleId is required (the backend stores roleid, not the role-name string). " +
        "Pick the role from the list returned by GET /roles/get.",
      400,
      null
    );
  }
  // The backend reads `body.role` as the *creator's* email/username for its
  // GetUserRole(creator, sessiontoken) lookup. Without this it returns 401.
  const creatorIdentity = String(creator ?? context.creator ?? "").trim();
  if (!creatorIdentity) {
    throw new APIError(
      "Missing creator identity. The backend looks up the requesting admin via the `role` field; " +
        "pass the logged-in user's email or username as `creator` (or context.creator).",
      400,
      null
    );
  }

  const { firstname, surname } = splitName(username, email);
  const inst = String(context.institutionCode || "").trim();
  const scopedInst = inst && inst !== "-1" ? inst : "";

  const body = {
    username: String(username).trim(),
    firstname,
    surname,
    email_address: String(email).trim().toLowerCase(),
    phone_number: String(phone || "").trim(),
    password: String(password),
    security: String(password),
    roleid: numericRoleId,
    // NOTE: `role` is intentionally the creator's identity, not a role-name string. See contract
    // comment above. The backend uses this to look up the calling admin's row in tbl_user_details.
    role: creatorIdentity,
    status: mapUiStatusToApi(status),
  };
  if (scopedInst) {
    body.financial_institution_code = scopedInst;
    body.institutionid_as_string = scopedInst;
    const iname = String(context.institutionName || "").trim();
    if (iname) {
      body.financial_institution_name = iname;
      body.institutionName = iname;
    }
  }

  return apiClient.put(API_ENDPOINTS.admin.createUser, body);
}

/**
 * `PUT /other-users/create` for roles 4-8. Requires institution id + name for
 * `tbl_map_card_users_institution`.
 */
export async function createOtherUserWithApi(
  { username, email, password, phone, roleId, status, creator },
  context = {}
) {
  if (!username?.trim() || !email?.trim() || !password) {
    throw new APIError("Username, email, and password are required.", 400, null);
  }
  const numericRoleId = toRoleId(roleId);
  if (numericRoleId === undefined || numericRoleId < 4 || numericRoleId > 8) {
    throw new APIError("Other users must use a role id from 4 to 8.", 400, null);
  }
  const creatorIdentity = String(creator ?? context.creator ?? "").trim();
  if (!creatorIdentity) {
    throw new APIError(
      "Missing creator identity. Pass the logged-in user's email or username as `creator`.",
      400,
      null
    );
  }
  const institutionId = String(context.institutionCode || "").trim();
  const institutionName = String(context.institutionName || "").trim();
  if (!institutionId || institutionId === "-1" || !institutionName) {
    throw new APIError("A linked institution is required to create an other user.", 400, null);
  }

  const { firstname, surname } = splitName(username, email);
  const body = {
    username: String(username).trim(),
    firstname,
    surname,
    email_address: String(email).trim().toLowerCase(),
    phone_number: String(phone || "").trim(),
    password: String(password),
    security: String(password),
    roleid: numericRoleId,
    role: creatorIdentity,
    status: mapUiStatusToApi(status),
    institutionid_as_string: institutionId,
    institutionName,
    financial_institution_code: institutionId,
    financial_institution_name: institutionName,
  };

  return apiClient.put(API_ENDPOINTS.admin.createOtherUser, body);
}

/**
 * `POST /users/edit` with `UserModel`. Same body contract as `createUserWithApi`:
 *   - `role`   = creator's identity (for backend lookup)
 *   - `roleid` = numeric role id of the user being edited
 */
export async function updateUserWithApi(
  { id, username, email, phone, roleId, status, password, creator },
  context = {}
) {
  if (id == null) throw new APIError("User id is required.", 400, null);
  const numericRoleId = toRoleId(roleId);
  if (numericRoleId === undefined) {
    throw new APIError("A numeric roleId is required for user edits.", 400, null);
  }
  const creatorIdentity = String(creator ?? context.creator ?? "").trim();
  if (!creatorIdentity) {
    throw new APIError(
      "Missing creator identity for user edit (backend reads it from the `role` field).",
      400,
      null
    );
  }

  const { firstname, surname } = splitName(username, email);
  const inst = String(context.institutionCode || "").trim();
  const scopedInst = inst && inst !== "-1" ? inst : "";

  const body = {
    id: typeof id === "string" && /^\d+$/.test(id) ? Number(id) : id,
    username: String(username).trim(),
    firstname,
    surname,
    email_address: String(email).trim().toLowerCase(),
    phone_number: String(phone || "").trim(),
    roleid: numericRoleId,
    role: creatorIdentity,
    status: mapUiStatusToApi(status),
  };
  if (scopedInst) {
    body.financial_institution_code = scopedInst;
    if (context.institutionName) body.financial_institution_name = String(context.institutionName).trim();
  }
  if (password) {
    body.password = String(password);
    body.security = String(password);
  }

  return apiClient.post(API_ENDPOINTS.admin.editUser, body);
}

/**
 * OpenAPI: `DELETE /users/{userid}/{username}`.
 */
export async function deleteUserWithApi({ userId, username }) {
  if (userId == null || !String(username || "").trim()) {
    throw new APIError("User id and username are required to delete a user.", 400, null);
  }
  const path = `/users/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(username).trim())}`;
  return apiClient.delete(path);
}
