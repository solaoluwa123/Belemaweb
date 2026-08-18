import { getActiveBrandConfig } from "../../branding/brandRuntime";

export function isMockAuthEnabled() {
  return String(import.meta.env.VITE_ENABLE_MOCK_AUTH ?? "false").toLowerCase() === "true";
}

/** Skip API login and enter as Role 4 — only when VITE_ENABLE_ROLE4_DEV_BYPASS=true (use in .env.development). */
export function isRole4DevBypassEnabled() {
  return String(import.meta.env.VITE_ENABLE_ROLE4_DEV_BYPASS ?? "false").toLowerCase() === "true";
}

export function getDevVendorConfig() {
  return {
    username: String(import.meta.env.VITE_DEV_VENDOR_USERNAME || "fi_contact_dev").trim(),
    email: String(import.meta.env.VITE_DEV_VENDOR_EMAIL || "vendor.dev@local").trim(),
    institutionCode: String(import.meta.env.VITE_DEV_VENDOR_INSTITUTION_CODE || "011").trim(),
    institutionName: String(import.meta.env.VITE_DEV_VENDOR_INSTITUTION_NAME || "First Bank of Nigeria").trim(),
    sessionToken: String(import.meta.env.VITE_DEV_VENDOR_AUTH_TOKEN || "dev-role4-bypass-token").trim(),
  };
}

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || getActiveBrandConfig().api.baseUrlFallback;
}

function getConfiguredApiAuthorizationValue() {
  const value = import.meta.env.VITE_API_AUTHORIZATION_HEADER;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (["false", "null", "undefined", "none"].includes(trimmed.toLowerCase())) return "";
  return trimmed;
}

export function getApiAuthorizationHeaderCandidates() {
  const trimmed = getConfiguredApiAuthorizationValue();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const candidates = [trimmed];
  if (lower.startsWith("bearer ")) {
    const raw = trimmed.replace(/^bearer\s+/i, "").trim();
    if (raw) candidates.push(raw);
  } else if (!lower.startsWith("basic ")) {
    candidates.push(`Bearer ${trimmed}`);
  }
  return [...new Set(candidates)];
}

export function getApiAuthorizationHeader() {
  return getApiAuthorizationHeaderCandidates()[0] || "";
}

export function getApiOrigin() {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return null;
  }
}

export function getRuntimeAppConfig() {
  const brand = getActiveBrandConfig();
  return {
    brand,
    apiBaseUrl: getApiBaseUrl(),
    apiAuthorizationHeader: getApiAuthorizationHeader(),
    apiOrigin: getApiOrigin(),
    mockAuthEnabled: isMockAuthEnabled(),
  };
}

/**
 * Optional JSON map: `{"Merchant":3,"PSSP":1,...}` — use when `wallettype` ids on the server
 * differ from the built-in defaults (avoids server 500s on bad FK lookups).
 */
export function getWalletTypeNameToIdMapFromEnv() {
  const raw = import.meta.env.VITE_WALLET_TYPE_MAP;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
