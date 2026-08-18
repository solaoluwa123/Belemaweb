import { getApiAuthorizationHeader, getApiAuthorizationHeaderCandidates } from "../config/runtimeConfig";
import { buildStorageKey, STORAGE_KEY_NAMES } from "../config/storage";
import { ROLE_IDS, THIRD_PARTY_VENDOR_ROLE_ID } from "../utils/roleAccess";

const THIRD_PARTY_VENDOR_ROLE_NAME = "Third Party Vendor";
import { apiClient, API_ENDPOINTS, APIError } from "./api";

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

  for (const key of ["data", "result", "results", "response", "content"]) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      return unwrapPayload(parsed[key]);
    }
  }

  return parsed;
}

function normalizeRole(rawRole, roleId = null) {
  const id = toRoleId(roleId);
  if (id === THIRD_PARTY_VENDOR_ROLE_ID) {
    return THIRD_PARTY_VENDOR_ROLE_NAME;
  }
  if (id === ROLE_IDS.ADMINISTRATOR) return "Admin";
  if (id === ROLE_IDS.OPERATOR) return "Operator";
  if (id === ROLE_IDS.APPROVER) return "Approver";
  const value = String(rawRole || "").trim().toLowerCase();
  if (!value) return "User";
  if (value.includes("third party") || value.includes("third-party")) {
    return THIRD_PARTY_VENDOR_ROLE_NAME;
  }
  if (value.includes("admin")) return "Admin";
  if (value.includes("approver")) return "Approver";
  if (value.includes("operator")) return "Operator";
  return String(rawRole).trim();
}

function normalizeMenuList(raw) {
  const parsed = unwrapPayload(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: row.id ?? null,
      roleId: row.role_id ?? row.roleId ?? null,
      parentId: row.parent_id ?? row.parentId ?? null,
      childId: row.child_id ?? row.childId ?? null,
      label: String(row.label || row.child_label || "").trim(),
      icon: String(row.icon || "").trim(),
      path: String(row.path || row.child_path || "").trim(),
      childLabel: String(row.child_label || "").trim(),
      childPath: String(row.child_path || "").trim(),
      raw: row,
    }))
    .filter((row) => row.label || row.path);
}

function toRoleId(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roleLabelFromRow(row) {
  if (!row || typeof row !== "object") return "";
  return String(
    row.role ||
      row.roleName ||
      row.name ||
      row.label ||
      row.description ||
      ""
  ).trim();
}

async function resolveRoleFromRoleId(roleId, sessionToken = "") {
  if (!roleId) return "";
  const staticAuthorization = getApiAuthorizationHeader();
  const authorization = staticAuthorization || (sessionToken ? `Bearer ${sessionToken}` : "");
  try {
    const payload = await apiClient.request(API_ENDPOINTS.admin.roles, {
      method: "GET",
      headers: {
        Authorization: authorization || "",
        "auth-token": sessionToken || "",
      },
    });
    const unwrapped = unwrapPayload(payload);
    const rows = Array.isArray(unwrapped)
      ? unwrapped
      : unwrapped && typeof unwrapped === "object"
        ? Object.values(unwrapped).find((v) => Array.isArray(v)) || []
        : [];
    const matched = rows.find((r) => {
      const idA = toRoleId(r?.id);
      const idB = toRoleId(r?.roleid);
      const idC = toRoleId(r?.roleId);
      return idA === roleId || idB === roleId || idC === roleId;
    });
    const matchedId = toRoleId(matched?.id ?? matched?.roleid ?? matched?.roleId);
    return normalizeRole(roleLabelFromRow(matched), matchedId);
  } catch {
    return "";
  }
}

function inferMustChangePassword(payload) {
  const value = `${payload?.status || ""} ${payload?.message || ""} ${payload?.security || ""}`.toLowerCase();
  return value.includes("change password") || value.includes("password expired") || value.includes("password reset");
}

function hasIdentity(user) {
  const hasId =
    user?.id !== undefined &&
    user?.id !== null &&
    String(user.id).trim() !== "";
  const hasEmail = String(user?.email || "").trim() !== "";
  return hasId || hasEmail;
}

function normalizeUser(payload) {
  const data = unwrapPayload(payload);
  if (!data || typeof data !== "object") {
    throw new APIError("Invalid authentication response from the backend.", 500, payload);
  }

  const firstName = String(data.firstname || "").trim();
  const surname = String(data.surname || "").trim();
  const username =
    String(data.username || "").trim() ||
    [firstName, surname].filter(Boolean).join(" ") ||
    String(data.email_address || "").trim();

  const roleId = toRoleId(data.roleid ?? data.roleId ?? data.role_id);

  return {
    id: data.id ?? data.userId ?? data.userid ?? data.user_id ?? null,
    username,
    email: String(
      data.email_address ||
      data.emailAddress ||
      data.email ||
      data.user_email ||
      ""
    ).trim(),
    roleName: normalizeRole(data.role || data.roleName || data.userRole, roleId),
    roleId,
    institutionName: String(data.financial_institution_name || data.institutionName || "").trim(),
    institutionCode: String(
      data.financial_institution_code ||
        data.financialInstitutionCode ||
        data.institution ||
        ""
    ).trim(),
    transgateMenu: normalizeMenuList(data.transgateMenu ?? data.transgate_menu),
    sparkpayMenu: normalizeMenuList(data.sparkpayMenu ?? data.sparkpay_menu),
    has2FA: Number(data.twofaenabled ?? data.twoFaEnabled ?? data.has2FA ?? 0) === 1,
    mustChangePassword: inferMustChangePassword(data),
    authSource: "live",
    sessionToken: String(
      data.session_token ||
      data.sessionToken ||
      data.token ||
      data.access_token ||
      data.accessToken ||
      data.auth_token ||
      data.authToken ||
      data.jwt ||
      ""
    ).trim(),
    refreshToken: String(data.refresh_token || data.refreshToken || "").trim(),
    raw: data,
  };
}

function getPending2faKey() {
  return buildStorageKey(STORAGE_KEY_NAMES.PENDING_2FA);
}

export function readPendingTwoFactorChallenge() {
  try {
    const raw = sessionStorage.getItem(getPending2faKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePendingTwoFactorChallenge(value) {
  sessionStorage.setItem(getPending2faKey(), JSON.stringify(value));
}

export function clearPendingTwoFactorChallenge() {
  sessionStorage.removeItem(getPending2faKey());
}

export async function loginWithApi(identifier, password) {
  const authorizationCandidates = getApiAuthorizationHeaderCandidates();
  const attempts = [...new Set([...authorizationCandidates, ""])];
  let response;
  let lastAuthError = null;

  for (const authorization of attempts) {
    try {
      response = await apiClient.request(API_ENDPOINTS.auth.login, {
        method: "POST",
        // Login should never reuse an existing session token. Use only the
        // configured static Authorization value (if provided for this API).
        headers: {
          Authorization: authorization || "",
          "auth-token": "",
        },
        body: JSON.stringify({
          username: identifier,
          password,
        }),
      });
      break;
    } catch (error) {
      lastAuthError = error;
      if (!(error instanceof APIError) || ![401, 403].includes(error.status)) {
        throw error;
      }
    }
  }

  if (response === undefined) {
    throw lastAuthError || new APIError("Unauthorized.", 401, null);
  }

  let user = normalizeUser(response);
  const sessionToken = user.sessionToken;
  if (!sessionToken) {
    throw new APIError(
      user.raw?.message || "Invalid username/email or password.",
      401,
      user.raw || response
    );
  }
  if (!hasIdentity(user)) {
    throw new APIError(
      "Authentication response is missing user identity (id/email).",
      401,
      user.raw || response
    );
  }
  if (user.roleName === "User" && user.roleId) {
    const resolved = await resolveRoleFromRoleId(user.roleId, sessionToken);
    if (resolved && resolved !== "User") {
      user = { ...user, roleName: resolved };
    }
  }

  if (user.has2FA) {
    writePendingTwoFactorChallenge({
      identifier,
      sessionToken,
      user,
    });

    return {
      requiresTwoFactor: true,
      user,
      sessionToken,
      message: user.raw?.message || "Enter the verification code from your authenticator app.",
    };
  }

  clearPendingTwoFactorChallenge();

  const key = buildStorageKey(STORAGE_KEY_NAMES.AUTH_TOKEN);
  localStorage.setItem(key, sessionToken);

  return {
  requiresTwoFactor: false,
  user,
  sessionToken,
  message: user.raw?.message || "Login successful.",
};
}

export async function verifyTwoFactorCode(code) {
  const challenge = readPendingTwoFactorChallenge();
  if (!challenge?.identifier || !challenge?.sessionToken) {
    throw new APIError("Your verification session expired. Please sign in again.", 400, challenge);
  }

  const staticAuthorization = getApiAuthorizationHeader();
  const response = await apiClient.request(API_ENDPOINTS.auth.verify2FA, {
    method: "POST",
    headers: {
      ...(staticAuthorization && { Authorization: staticAuthorization }),
      "auth-token": challenge.sessionToken,
    },
    body: JSON.stringify({
      username: challenge.identifier,
      password: code,
    }),
  });

  let user = normalizeUser(response);
  clearPendingTwoFactorChallenge();

  const sessionToken = user.sessionToken || challenge.sessionToken;
  if (user.roleName === "User" && user.roleId) {
    const resolved = await resolveRoleFromRoleId(user.roleId, sessionToken);
    if (resolved && resolved !== "User") {
      user = { ...user, roleName: resolved };
    }
  }
  localStorage.setItem(buildStorageKey(STORAGE_KEY_NAMES.AUTH_TOKEN), sessionToken);

  return {
    user,
    sessionToken,
    message: user.raw?.message || "Verification successful.",
  };
}

export async function logoutFromApi({ identifier = "" } = {}) {
  try {
    await apiClient.request(API_ENDPOINTS.auth.logout, {
      method: "POST",
      body: JSON.stringify({
        username: identifier,
        password: "",
      }),
    });
  } finally {
    clearPendingTwoFactorChallenge();
  }
}

export async function requestPasswordRecovery(identifier) {
  return apiClient.request(API_ENDPOINTS.auth.recoverPassword, {
    method: "POST",
    body: JSON.stringify({
      username: identifier,
      password: "",
    }),
  });
}

export async function updatePasswordWithApi(user, newPassword) {
  if (!user?.id) {
    throw new APIError("A valid authenticated user is required to update the password.", 400, user);
  }

  return apiClient.request(API_ENDPOINTS.auth.updatePassword, {
    method: "POST",
    body: JSON.stringify({
      id: user.id,
      username: user.username,
      email_address: user.email,
      institutionName: user.institutionName,
      institution: user.institutionCode,
      security: newPassword,
    }),
  });
}

/** Password recovery: set new password using token from email link (`POST /users/resetpassword`). */
export async function resetPasswordWithApi({ username, password, token = "" }) {
  if (!password) {
    throw new APIError("Password is required.", 400, null);
  }
  return apiClient.request(API_ENDPOINTS.auth.resetPassword, {
    method: "POST",
    body: JSON.stringify({
      username: String(username || "").trim(),
      password: String(password),
      security: String(password),
      session_token: String(token || "").trim(),
      token: String(token || "").trim(),
    }),
  });
}

/** Optional: exchange refresh token for new session (`POST /auth/refresh`). */
export async function refreshAccessTokenWithApi(refreshToken) {
  if (!refreshToken) {
    throw new APIError("Refresh token is required.", 400, null);
  }
  return apiClient.request(API_ENDPOINTS.auth.refreshToken, {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
