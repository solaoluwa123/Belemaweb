import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  readLocalStorage,
  removeLocalStorage,
  setLocalStorage,
  STORAGE_KEY_NAMES,
  buildStorageKey,
} from "../config/storage";
import { getAvailableBrands, getActiveBrandConfig } from "../../branding/brandRuntime";
import {
  clearPendingTwoFactorChallenge,
  getPostAuthRedirectPath,
  loginWithApi,
  logoutFromApi,
  readPendingTwoFactorChallenge,
  updatePasswordWithApi,
  verifyTwoFactorCode,
} from "../services/auth";
import { APIError } from "../services/api";
import { isMockAuthEnabled, isRole4DevBypassEnabled } from "../config/runtimeConfig";
import { isDevBypassUser, loginWithDevVendorBypass } from "../services/devVendorAuth";
import {
  isThirdPartyVendor as checkThirdPartyVendor,
  isAdministrator,
  isOperatorRole,
  isApproverRole,
  canLogSwitchDispute,
  canApproveSwitchDispute,
  canRequestStatusChange,
  canMutateWallets,
  canManageUsers,
  canManageFI,
  getInstitutionScope,
  requiresInstitutionScope,
} from "../utils/roleAccess";

const AuthContext = createContext(undefined);

function getLoginErrorMessage(error) {
  if (!(error instanceof APIError)) {
    return error?.message || "Unable to sign in right now.";
  }

  const apiMessage = String(error.message || "").trim();
  const normalized = apiMessage.toLowerCase();

  if (normalized.includes("locked")) {
    return "Account locked.";
  }

  if (
    normalized.includes("missing user identity") ||
    normalized.includes("invalid username") ||
    normalized.includes("invalid email") ||
    normalized.includes("invalid password") ||
    normalized.includes("wrong password") ||
    normalized.includes("bad credentials")
  ) {
    return "Invalid Email/password.";
  }

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("unathorized") ||
    normalized.includes("authorization") ||
    normalized.includes("auth-token") ||
    normalized.includes("invalid value in header")
  ) {
    return "Unauthorized.";
  }

  if (error.status === 401) {
    return "Invalid Email/password.";
  }

  return apiMessage || "Unable to sign in right now.";
}

function loadStoredUser() {
  try {
    const token = readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
    if (!token) return null;
    // Prefer AUTH_USER; fall back to USER_DATA for older/alternate storage writes.
    const raw = readLocalStorage(STORAGE_KEY_NAMES.AUTH_USER) || readLocalStorage(STORAGE_KEY_NAMES.USER_DATA);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Some stored user payloads may use different key names.
    // Disputes list endpoint selection depends on `user.institutionCode`.
    const institutionCode =
      parsed.institutionCode ||
      parsed.financialInstitutionCode ||
      parsed.financial_institution_code ||
      parsed.institutioncode ||
      parsed.institutioncode?.code ||
      parsed.institution?.code ||
      parsed.institution?.financialInstitutionCode ||
      "";

    // Only override if we are currently missing it.
    if (!parsed.institutionCode && institutionCode) {
      parsed.institutionCode = String(institutionCode).trim();
    }

    // Similar for institutionName (used for display in some screens).
    const institutionName =
      parsed.institutionName ||
      parsed.financialInstitutionName ||
      parsed.financial_institution_name ||
      parsed.institutionname ||
      parsed.institution?.name ||
      "";

    if (!parsed.institutionName && institutionName) {
      parsed.institutionName = String(institutionName).trim();
    }

    if (!Array.isArray(parsed.transgateMenu) && parsed.raw?.transgateMenu) {
      parsed.transgateMenu = parsed.raw.transgateMenu;
    }
    if (!parsed.roleId && parsed.raw?.roleid != null) {
      parsed.roleId = Number(parsed.raw.roleid);
    }

    return parsed;
  } catch {
    return null;
  }
}

function copyAuthFromOtherBrandsIfMissing() {
  // If we already have auth for the active brand, do nothing.
  const currentToken = readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
  const currentUserRaw = readLocalStorage(STORAGE_KEY_NAMES.AUTH_USER) || readLocalStorage(STORAGE_KEY_NAMES.USER_DATA);
  if (currentToken && currentUserRaw) return;

  const currentBrandId = getActiveBrandConfig().id;
  const brands = getAvailableBrands();

  for (const brand of brands) {
    if (brand.id === currentBrandId) continue;

    try {
      const tokenKey = buildStorageKey(STORAGE_KEY_NAMES.AUTH_TOKEN, brand.id);
      const userKey = buildStorageKey(STORAGE_KEY_NAMES.AUTH_USER, brand.id);
      const userDataKey = buildStorageKey(STORAGE_KEY_NAMES.USER_DATA, brand.id);
      const token = localStorage.getItem(tokenKey);
      const raw = localStorage.getItem(userKey) || localStorage.getItem(userDataKey);

      if (token && raw) {
        // Copy into the current brand namespace so apiClient can read it.
        setLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN, token);
        setLocalStorage(STORAGE_KEY_NAMES.AUTH_USER, raw);
        // Also set USER_DATA so any components relying on the fallback can hydrate consistently.
        setLocalStorage(STORAGE_KEY_NAMES.USER_DATA, raw);
        return;
      }
    } catch {
      // Ignore and keep searching.
    }
  }
}

function clearStoredAuth() {
  removeLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN);
  removeLocalStorage(STORAGE_KEY_NAMES.REFRESH_TOKEN);
  removeLocalStorage(STORAGE_KEY_NAMES.USER_DATA);
  removeLocalStorage(STORAGE_KEY_NAMES.AUTH_USER);
  clearPendingTwoFactorChallenge();
}

function persistAuthenticatedUser(userData, sessionToken) {
  if (!userData || typeof userData !== "object") return;
  const { refreshToken, ...rest } = userData;
  if (sessionToken) {
    setLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN, sessionToken);
  }
  if (refreshToken) {
    setLocalStorage(STORAGE_KEY_NAMES.REFRESH_TOKEN, refreshToken);
  }
  setLocalStorage(STORAGE_KEY_NAMES.AUTH_USER, JSON.stringify(rest));
  setLocalStorage(STORAGE_KEY_NAMES.USER_DATA, JSON.stringify(rest));
}

export function AuthProvider({ children }) {
  // Ensure we have an auth token in the current brand namespace before loading user/token.
  copyAuthFromOtherBrandsIfMissing();
  const [user, setUser] = useState(loadStoredUser);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(readPendingTwoFactorChallenge);

  useEffect(() => {
    if (!readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN)) {
      removeLocalStorage(STORAGE_KEY_NAMES.AUTH_USER);
      removeLocalStorage(STORAGE_KEY_NAMES.USER_DATA);
      if (user != null) setUser(null);
    }
  }, []);

  /**
   * Auto-logout when the backend rejects our session token.
   * `apiClient` dispatches `auth:session-expired` on a 401 from authenticated requests.
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      // No-op if we are already signed out (prevents duplicate toasts when many
      // requests fire 401 in parallel during the same expiry window).
      if (!readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN)) return;
      if (isDevBypassUser(loadStoredUser())) return;
      clearStoredAuth();
      setUser(null);
      setPendingTwoFactor(null);
      toast.error("Your session has expired. Please sign in again.");
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  /**
   * Cross-tab sync: if another tab signs out, clear this tab too.
   */
  useEffect(() => {
    const tokenStorageKey = buildStorageKey(STORAGE_KEY_NAMES.AUTH_TOKEN);
    const handleStorage = (event) => {
      if (event.key !== tokenStorageKey) return;
      if (!event.newValue) {
        setUser(null);
        setPendingTwoFactor(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = (userData, sessionToken) => {
    persistAuthenticatedUser(userData, sessionToken || userData?.sessionToken || "");
    setUser(userData);
  };

  const loginAsDevVendor = () => {
    try {
      const result = loginWithDevVendorBypass();
      persistAuthenticatedUser(result.user, result.sessionToken);
      setPendingTwoFactor(null);
      setUser(result.user);
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Unable to start dev vendor session.",
      };
    }
  };

  const loginWithCredentials = async (identifier, password) => {
    try {
      // Use shared auth client so required headers (Authorization, auth-token) are attached.
      const result = await loginWithApi(identifier, password);

      if (result.requiresTwoFactor) {
        setPendingTwoFactor(readPendingTwoFactorChallenge());
        return {
          success: true,
          requiresTwoFactor: true,
          message: result.message,
        };
      }

      persistAuthenticatedUser(result.user, result.sessionToken);
      setPendingTwoFactor(null);
      setUser(result.user);

      return {
        success: true,
        mustChangePassword: !!result.user?.mustChangePassword,
        require2faSetup: !!result.user?.require2faSetup,
        redirectTo: getPostAuthRedirectPath(result.user),
      };
    } catch (error) {
      return {
        success: false,
        error: getLoginErrorMessage(error),
      };
    }
  };

  const verifyTwoFactor = async (otp) => {
    try {
      const result = await verifyTwoFactorCode(otp);
      persistAuthenticatedUser(result.user, result.sessionToken);
      setPendingTwoFactor(null);
      setUser(result.user);
      return {
        success: true,
        mustChangePassword: !!result.user.mustChangePassword,
        require2faSetup: !!result.user.require2faSetup,
        redirectTo: getPostAuthRedirectPath(result.user),
      };
    } catch (error) {
      const message = error instanceof APIError ? error.message : "Unable to verify the authentication code.";
      return { success: false, error: message };
    }
  };

  const completePasswordChange = async (userId, newPassword, currentPassword = "") => {
    if (!user) {
      return { success: false, error: "Not signed in." };
    }
    if (userId != null && String(user.id) !== String(userId) && user.id != null) {
      // Allow when id missing from login payload but email/username match.
    }

    try {
      await updatePasswordWithApi(user, newPassword, currentPassword);
      const nextUser = {
        ...user,
        mustChangePassword: false,
        require2faSetup: !!user.require2faSetup && !user.has2FA,
      };
      persistAuthenticatedUser(nextUser, readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN) || "");
      setUser(nextUser);
      return {
        success: true,
        require2faSetup: !!nextUser.require2faSetup,
        redirectTo: getPostAuthRedirectPath(nextUser),
      };
    } catch (error) {
      const message = error instanceof APIError ? error.message : "Failed to update password.";
      return { success: false, error: message };
    }
  };

  const updateUser = (patch) => {
    if (!user || !patch || typeof patch !== "object") return;
    const nextUser = { ...user, ...patch };
    persistAuthenticatedUser(nextUser, readLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN) || user.sessionToken || "");
    setUser(nextUser);
  };

  const logout = async () => {
    const identifier = user?.email || user?.username || "";
    // Call the API first so the session token is still attached and the backend can
    // invalidate the session. Local state is cleared afterwards regardless of API outcome,
    // so the user is always signed out from this client even on network/auth failures.
    if (!isDevBypassUser(user)) {
      try {
        await logoutFromApi({ identifier });
      } catch {
        // Intentionally ignored — local sign-out below is the source of truth for the SPA.
      }
    }
    clearStoredAuth();
    setUser(null);
    setPendingTwoFactor(null);
  };

  const isThirdPartyVendor = () => checkThirdPartyVendor(user);

  /** Belema `tbl_role.id` 1 — Administrator. */
  const isAdmin = () => isAdministrator(user);

  /** Belema `tbl_role.id` 3 — Approver. */
  const isApprover = () => isApproverRole(user);

  /** Belema `tbl_role.id` 2 — Operator. */
  const isOperator = () => isOperatorRole(user);

  const isInstitutionUser = () => {
    if (user === null) return false;
    return !isAdmin() && !isApprover() && !isOperator();
  };

  /** Operator (and similar day-to-day roles): may submit maker–checker requests only — not approvals. */
  const canSubmitRequests = () => isOperator() && !isThirdPartyVendor();

  /** Approver: may action pending approvals only — not submit operator requests. */
  const canApproveRequests = () => isApprover() && !isThirdPartyVendor();

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsDevVendor,
        loginWithCredentials,
        completePasswordChange,
        updateUser,
        logout,
        verifyTwoFactor,
        isAdmin,
        isApprover,
        isOperator,
        isInstitutionUser,
        isThirdPartyVendor,
        canSubmitRequests,
        canApproveRequests,
        canLogSwitchDispute: () => canLogSwitchDispute(user, { isOperator: isOperator() }),
        canApproveSwitchDispute: () => canApproveSwitchDispute(user),
        canRequestStatusChange: () => canRequestStatusChange(user),
        canMutateWallets: () => canMutateWallets(user),
        canManageUsers: () => canManageUsers(user),
        canManageFI: () => canManageFI(user),
        getInstitutionScope: (override) => getInstitutionScope(user, override),
        requiresInstitutionScope: () => requiresInstitutionScope(user),
        pendingTwoFactor,
        isMockAuthEnabled: isMockAuthEnabled(),
        isRole4DevBypassEnabled,
        isDevBypassSession: () => isDevBypassUser(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
