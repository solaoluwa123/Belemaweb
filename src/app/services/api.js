import { getApiAuthorizationHeader, getApiBaseUrl } from "../config/runtimeConfig";
import { readLocalStorage, STORAGE_KEY_NAMES } from "../config/storage";

export const API_CONFIG = {
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

export const API_ENDPOINTS = {
  auth: {
    login: '/users/login',
    logout: '/users/logout',
    verify2FA: '/users/login-2fa',
    setup2FA: '/users/setup-2fa',
    refreshToken: '/auth/refresh',
    recoverPassword: '/users/recoverpassword',
    resetPassword: '/users/resetpassword',
    updatePassword: '/users/update-password',
  },
  transactions: {
    list: '/transactions',
    search: '/transactions/q/search',
    details: (id) => `/transactions/${id}`,
    /** Alternate read by session id (OpenAPI). */
    bySessionId: (sessionId) => `/transactions-by-session-id/${sessionId}`,
    /** List for one institution code. */
    byInstitution: (institutionCode) => `/transactions/institution/${institutionCode}`,
    /** Batch lookup by session ids (POST body per API). */
    bySessionIds: '/transactions-by-session-ids',
    statusUpdate: '/transaction/status/change',
    pendingStatusUpdates: '/transactions-for-update',
    live: '/transactions',
  },
  disputes: {
    listByInstitution: (institutionCode) => `/transactions/disputes/institution/${institutionCode}`,
    arbitratedByInstitution: (institutionCode) =>
      `/transactions/arbitrated-disputes/institution/${institutionCode}`,
    search: '/transactions/disputes/q/search',
    types: '/transactions/disputes/types/get',
    create: '/transactions/disputes/create',
    approve: '/transactions/disputes/approve',
    details: (id) => `/transactions/disputes/get/${id}`,
  },
  dashboards: {
    transactionsSummary: '/transactions-summary',
    transactionsSummaryByInstitution: (code) => `/transactions-summary/institution/${code}`,
    successfulTransactionCount: '/successful-transaction-count',
    successfulTransactionCountByInstitution: (code) => `/successful-transaction-count/institution/${code}`,
    transactionsByDate: '/transactions-by-date',
    transactionsByDateByInstitution: (code) => `/transactions-by-date/institution/${code}`,
    transactionsByDateOnly: '/transactions-by-date-only',
    transactionsByDateOnlyByInstitution: (code) => `/transactions-by-date-only/institution/${code}`,
    transactionsByChannels: '/transactions-by-channels',
    transactionsByChannelsByInstitution: (code) => `/transactions-by-channels/institution/${code}`,
    topFailedResponseCodes: '/top-failed-response-codes',
    topFailedResponseCodesByInstitution: (code) => `/top-failed-response-codes/institution/${code}`,
    topFailingInstitutions: '/top-failing-institutions',
    topFailingInstitutionsByInstitution: (code) => `/top-failing-institutions/institution/${code}`,
    ftAverageTime: '/ft-average-time',
    ftAverageTimeByInstitution: (code) => `/ft-average-time/institution/${code}`,
    transactionsTrendByInstitution: (code) => `/transactions-trend/${code}`,
    transactionsRates: '/transactions-rates',
    liveMonitoring: '/transactions/live-monitoring',
    liveFeed: '/transactions/live-feed',
    statusSummary: '/transactions/status-summary',
  },
  wallets: {
    list: '/wallets/get',
    listByInstitution: (code) => `/wallets/get/${code}`,
    actions: '/wallets/get/actions',
    details: (number) => `/wallet/${number}`,
    activity: (number) => `/wallet/activity/${number}`,
    activityAll: '/wallets/activity/all',
    activityInstitutionAggregates: '/wallets/activity/institution-aggregates',
    create: '/wallets/create',
    edit: '/wallets/edit',
    status: '/wallets/status',
    bulkDelete: '/wallets/bulk-delete',
    /**
     * Stage a pending credit/debit operation on a wallet (maker step).
     * Backend `PUT /wallets/initiate-debit-credit` — `WalletsController.InitiateDebitCreditWallet`.
     * Body is a `WalletModel` with `{ walletnumber, actionType: "cr"|"dr", amount, creator }`;
     * the service looks up `walletname` / `financialInstitutionCode` from `tbl_wallets`.
     * On success the row lands in `tbl_wallets_operations` with `actionType = "credit"|"debit"`
     * and is approved by another user via `/wallets/approval` (same endpoint as wallet creates).
     */
    initiateDebitCredit: '/wallets/initiate-debit-credit',
    approval: '/wallets/approval',
    /**
     * Approve a pending credit/debit (funding) operation. Distinct from `/wallets/approval`
     * which handles wallet create/edit/assign/delete approvals — funding has its own endpoint
     * that the backend uses to apply the balance change.
     */
    approveFunding: '/wallets/approve-funding',
    /** Reject a pending credit/debit (funding) operation. */
    rejectFunding: '/wallets/reject-funding',
  },
  approvals: {
    users: '/users/get',
    userActions: '/users/get/actions',
    otherUserActions: '/other-users/get/actions',
    contactActions: '/financial-institutions/contacts/get/actions',
    /** Role-4 pending rows in `tbl_user_details_operations` (`UsersService.GetContactsForActions`). */
    contactsUserActions: '/contacts/get/actions',
    approveUser: '/users/approval',
    approveContactUser: '/users/contact/approval',
    rejectUser: (id) => `/users/reject/${id}`,
    rejectContact: (id, email) => `/contact/reject/${id}/${encodeURIComponent(email)}`,
    wallets: '/wallets/get',
    walletActions: '/wallets/get/actions',
    approveWallet: '/wallets/approval',
    institutions: '/financial-institutions',
    institutionActions: '/financial-institutions/get/actions',
    approveInstitution: '/financial-institutions/approval',
    rejectInstitution: '/financial-institutions/reject',
    rejectInstitutionById: (id) => `/financial-institutions/reject/${id}`,
  },
  admin: {
    users: '/users/get',
    otherUsers: '/other-users/get',
    userActions: '/users/get/actions',
    otherUserActions: '/other-users/get/actions',
    createUser: '/users/create',
    createOtherUser: '/other-users/create',
    editUser: '/users/edit',
    reset2fa: '/users/reset-2fa',
    rejectUser: (id) => `/users/reject/${id}`,
    deleteUser: (userId, username) => `/users/${userId}/${username}`,
    institutions: '/financial-institutions',
    institutionByCode: (code) => `/financial-institutions/${code}`,
    institutionActions: '/financial-institutions/get/actions',
    institutionTypes: '/financial-institutions/types',
    createInstitution: '/financial-institutions',
    editInstitution: '/financial-institutions',
    deleteInstitution: (code, username) => `/financial-institutions/${code}/${username}`,
    contacts: '/financial-institutions/contacts',
    contactById: (id) => `/financial-institutions/contacts/${id}`,
    contactActions: '/financial-institutions/contacts/get/actions',
    contactsByInstitution: (code) => `/financial-institutions/contacts/institution/${code}`,
    contactActionsByInstitution: (code) => `/financial-institutions/contacts/institution/get/actions/${code}`,
    createContact: '/financial-institutions/contacts',
    editContact: '/financial-institutions/contacts',
    deleteContact: (email, username) =>
      `/financial-institutions/contacts/${encodeURIComponent(email)}/${encodeURIComponent(username)}`,
    rejectContact: (id, email) => `/contact/reject/${id}/${encodeURIComponent(email)}`,
    roles: '/roles/get',
    auditLogs: '/audit-logs',
    auditLogById: (id) => `/audit-logs/${id}`,
    merchants: '/cards/merchants',
    terminalOwners: '/cards/terminal-owners',
    ptsps: '/cards/ptsps',
  },
  /**
   * Change-requests queue is intentionally sourced from `/wallets/get/actions` in `changeRequests.js`.
   * `submit` is kept as a legacy fallback for resource types not handled by `submitDirectResourceAction`.
   */
  changeRequests: {
    submit: '/change-requests/submit',
  },
};

function extractErrorMessage(body, status) {
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 800);
  if (!body || typeof body !== "object") return `Request failed (${status})`;

  const nested =
    body.data && typeof body.data === "object" && body.data.message != null
      ? String(body.data.message)
      : null;

  const statusText =
    typeof body.status === "string" && body.status.toLowerCase() === "error" && body.message
      ? String(body.message)
      : null;

  const codeHint =
    body.code != null && body.message
      ? `[${body.code}] ${String(body.message)}`
      : null;

  return (
    nested ||
    statusText ||
    codeHint ||
    body.message ||
    body.error ||
    body.detail ||
    (typeof body.status === "string" && body.status !== "error" ? body.status : null) ||
    `Request failed (${status})`
  );
}

function maskSensitiveHeaderValue(value) {
  const raw = String(value || "");
  if (!raw) return raw;
  if (raw.length <= 14) return "***";
  return `${raw.slice(0, 10)}...${raw.slice(-4)}`;
}

function sanitizeHeadersForDebug(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null || value === "") continue;
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "auth-token") {
      out[key] = maskSensitiveHeaderValue(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isWalletRequestUrl(url = "") {
  const u = String(url).toLowerCase();
  return u.includes("/wallet");
}

function isAuthRequestUrl(url = "") {
  const u = String(url).toLowerCase();
  return u.includes("/users/login") || u.includes("/users/login-2fa");
}

/**
 * Endpoints that may legitimately return 401 without indicating a real session expiry.
 *
 * Auto-logout is reserved for background reads where 401 almost always means the JWT is gone.
 * For explicit user-initiated writes (create/edit/delete users, wallets, institutions, contacts,
 * disputes, etc.), a 401 is more likely a permissions or backend-data issue than a session
 * problem — kicking the user out of the app on those is hostile and hides the real error.
 */
function isSessionExpiryExemptUrl(url = "", method = "GET") {
  const u = String(url).toLowerCase();
  const m = String(method || "GET").toUpperCase();
  if (
    isAuthRequestUrl(u) ||
    u.includes("/users/logout") ||
    u.includes("/users/recoverpassword") ||
    u.includes("/users/resetpassword") ||
    u.includes("/auth/refresh")
  ) {
    return true;
  }
  // Admin-write endpoints — surface the error in-page instead of force-logging-out.
  const explicitWriteUrl =
    u.includes("/users/create") ||
    u.includes("/other-users/create") ||
    u.includes("/users/edit") ||
    u.includes("/users/approval") ||
    u.includes("/users/reject") ||
    u.includes("/wallets/create") ||
    u.includes("/wallets/edit") ||
    u.includes("/wallets/approval") ||
    u.includes("/financial-institutions/contacts") ||
    u.includes("/financial-institutions/approval") ||
    u.includes("/financial-institutions/reject");
  if (explicitWriteUrl) return true;
  // Financial-institutions REST routes don't use `/{verb}` naming — the create endpoint is
  // `PUT /financial-institutions` (same URL as the GET list). Treat any non-GET against the
  // institutions base path as a write, so a 401 from the backend (e.g. role check) surfaces
  // as an in-page error instead of force-logging the operator out.
  if (m !== "GET" && u.includes("/financial-institutions")) return true;
  return false;
}

/** Notify the app that the backend rejected our session token; AuthContext logs the user out. */
function dispatchSessionExpired(detail = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("auth:session-expired", { detail }));
  } catch {
    // CustomEvent constructor unavailable; safe to ignore.
  }
}

function isApprovalRequestUrl(url = "") {
  const u = String(url).toLowerCase();
  return (
    u.includes("/change-requests") ||
    u.includes("/users/get") ||
    u.includes("/wallets/get") ||
    u.includes("/financial-institutions") ||
    u.includes("/transactions-for-update") ||
    u.includes("/transactions/disputes")
  );
}

function sanitizeBodyForDebug(url, body) {
  if (!isAuthRequestUrl(url)) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const copy = { ...body };
  if (copy.password !== undefined) copy.password = "***";
  if (copy.security !== undefined) copy.security = "***";
  if (copy.token !== undefined && String(copy.token).trim()) copy.token = "***";
  if (copy.session_token !== undefined && String(copy.session_token).trim()) copy.session_token = "***";
  return copy;
}

function shouldDebugRequest(url = "") {
  return isWalletRequestUrl(url) || isAuthRequestUrl(url) || isApprovalRequestUrl(url);
}

function isApiDebugEnabled() {
  if (typeof import.meta === "undefined" || !import.meta.env) return false;
  if (import.meta.env.DEV) return true;
  return String(import.meta.env.VITE_DEBUG_API ?? "").toLowerCase() === "true";
}

function debugRequest(url, config) {
  if (typeof window === "undefined" || !isApiDebugEnabled()) return;
  if (!shouldDebugRequest(url)) return;
  try {
    const headers = sanitizeHeadersForDebug(config?.headers || {});
    let parsedBody = config?.body;
    if (typeof parsedBody === "string") {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        // Keep raw string when not JSON.
      }
    }
    const body = sanitizeBodyForDebug(url, parsedBody);
    const tag = isWalletRequestUrl(url) ? "Wallet API" : isAuthRequestUrl(url) ? "Auth API" : "Approval API";
    console.groupCollapsed(`[${tag}] ${config?.method || "GET"} ${url}`);
    console.log("headers:", headers);
    console.log("request:", {
      method: config?.method || "GET",
      url,
      body,
    });
    console.groupEnd();
  } catch {
    // Never let debug logging break requests.
  }
}

class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
  }

  async parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
    const staticAuthorization = getApiAuthorizationHeader();
    // Backend expects a configured Authorization value (API key/bearer) plus session token in `auth-token`
    // for most protected routes. Keep session bearer only as fallback when static auth is not configured.
    const sessionAuthorization = token ? `Bearer ${token}` : "";
    const authorizationHeader = staticAuthorization || sessionAuthorization || undefined;

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
      ...(token ? { "auth-token": token } : {}),
      ...options.headers,
    };

    const sanitizedHeaders = Object.fromEntries(
      Object.entries(headers).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    );

    const config = {
      ...options,
      headers: sanitizedHeaders,
      signal:
        typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(this.timeout) : undefined,
    };

    try {
      debugRequest(url, config);
      const response = await fetch(url, config);
      const body = await this.parseResponseBody(response);
      if (typeof window !== "undefined" && isApiDebugEnabled() && shouldDebugRequest(url)) {
        const tag = isWalletRequestUrl(url) ? "Wallet API" : isAuthRequestUrl(url) ? "Auth API" : "Approval API";
        console.log(`[${tag}] response`, {
          url,
          status: response.status,
          ok: response.ok,
          body,
        });
      }

      if (!response.ok) {
        if (
          response.status === 401 &&
          Boolean(token) &&
          !isSessionExpiryExemptUrl(url, options?.method || "GET")
        ) {
          dispatchSessionExpired({ url, status: response.status });
        }
        throw new APIError(extractErrorMessage(body, response.status), response.status, body);
      }

      return body;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError('Network error', 0, error);
    }
  }

  async get(endpoint, params) {
    const queryString =
      params && typeof params === "object" && Object.keys(params).length
        ? "?" + new URLSearchParams(params).toString()
        : "";
    return this.request(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = new APIClient();

export const ENV = {
  isDevelopment: import.meta.env.MODE === "development",
  isProduction: import.meta.env.MODE === "production",
  apiBaseUrl: getApiBaseUrl(),
  apiAuthorizationHeader: getApiAuthorizationHeader(),
};
