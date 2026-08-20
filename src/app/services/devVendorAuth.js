import { setLocalStorage, STORAGE_KEY_NAMES } from "../config/storage";
import { getDevVendorConfig, isRole4DevBypassEnabled } from "../config/runtimeConfig";
import { THIRD_PARTY_VENDOR_ROLE_ID } from "../utils/roleAccess";

const DEV_TRANSGATE_MENU = [
  { label: "Dashboard", path: "/dashboard/accounts", icon: "dashboard" },
  { label: "Transactions", path: "/transactions", icon: "transactions" },
  { label: "Wallets", path: "/wallets", icon: "wallets" },
  { label: "Wallet Activities", path: "/wallets/activities", icon: "activity" },
  { label: "Log Dispute", path: "/disputes/log", icon: "disputes" },
];

export function buildDevVendorUser(overrides = {}) {
  const cfg = { ...getDevVendorConfig(), ...overrides };
  return {
    id: "dev-vendor-001",
    username: cfg.username,
    email: cfg.email,
    roleName: "Third Party Vendor",
    roleId: THIRD_PARTY_VENDOR_ROLE_ID,
    institutionName: cfg.institutionName,
    institutionCode: cfg.institutionCode,
    transgateMenu: DEV_TRANSGATE_MENU,
    sparkpayMenu: [],
    has2FA: false,
    mustChangePassword: false,
    authSource: "dev-bypass",
    sessionToken: cfg.sessionToken,
    refreshToken: "",
  };
}

/**
 * Local sign-in as Role 4 without calling POST /users/login.
 * Requires VITE_ENABLE_ROLE4_DEV_BYPASS=true (dev builds only).
 */
export function loginWithDevVendorBypass(overrides = {}) {
  if (!isRole4DevBypassEnabled()) {
    throw new Error("Role 4 dev bypass is disabled. Set VITE_ENABLE_ROLE4_DEV_BYPASS=true in .env.development.");
  }

  const user = buildDevVendorUser(overrides);
  const sessionToken = user.sessionToken;
  setLocalStorage(STORAGE_KEY_NAMES.AUTH_TOKEN, sessionToken);

  return {
    user,
    sessionToken,
    message: "Signed in as Third Party Vendor (development bypass).",
  };
}

export function isDevBypassUser(user) {
  return user?.authSource === "dev-bypass";
}
