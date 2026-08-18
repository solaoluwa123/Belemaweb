import { getActiveBrandConfig } from "../../branding/brandRuntime";

const STORAGE_NAMESPACE = "platform";

export const STORAGE_KEY_NAMES = {
  AUTH_TOKEN: "auth_token",
  REFRESH_TOKEN: "refresh_token",
  USER_DATA: "user_data",
  THEME: "theme",
  SIDEBAR_STATE: "sidebar_state",
  TABLE_PAGE_SIZE: "table_page_size",
  AUTH_USER: "auth_user",
  REMEMBER_EMAIL: "remember_email",
  PENDING_2FA: "pending_2fa",
  ACTIVATION_REQUESTS: "activation_requests",
  RATE_LIMITER_ATTEMPTS: "rate_limiter_attempts",
};

const LEGACY_STORAGE_KEYS = {
  [STORAGE_KEY_NAMES.AUTH_TOKEN]: ["etrns_auth_token", "authToken"],
  [STORAGE_KEY_NAMES.REFRESH_TOKEN]: ["etrns_refresh_token"],
  [STORAGE_KEY_NAMES.USER_DATA]: ["etrns_user_data"],
  [STORAGE_KEY_NAMES.THEME]: ["etrns_theme"],
  [STORAGE_KEY_NAMES.SIDEBAR_STATE]: ["etrns_sidebar_state"],
  [STORAGE_KEY_NAMES.TABLE_PAGE_SIZE]: ["etrns_table_page_size"],
  [STORAGE_KEY_NAMES.AUTH_USER]: ["etrns_auth_user"],
  [STORAGE_KEY_NAMES.REMEMBER_EMAIL]: ["etrns_remember_email"],
  [STORAGE_KEY_NAMES.PENDING_2FA]: [],
  [STORAGE_KEY_NAMES.ACTIVATION_REQUESTS]: ["etrns_activation_requests"],
  [STORAGE_KEY_NAMES.RATE_LIMITER_ATTEMPTS]: ["etrns_rate_limiter_attempts"],
};

function buildStorageKey(keyName, brandId = getActiveBrandConfig().id) {
  return `${STORAGE_NAMESPACE}_${brandId}_${keyName}`;
}

export function getStorageKeys(brandId = getActiveBrandConfig().id) {
  return {
    AUTH_TOKEN: buildStorageKey(STORAGE_KEY_NAMES.AUTH_TOKEN, brandId),
    REFRESH_TOKEN: buildStorageKey(STORAGE_KEY_NAMES.REFRESH_TOKEN, brandId),
    USER_DATA: buildStorageKey(STORAGE_KEY_NAMES.USER_DATA, brandId),
    THEME: buildStorageKey(STORAGE_KEY_NAMES.THEME, brandId),
    SIDEBAR_STATE: buildStorageKey(STORAGE_KEY_NAMES.SIDEBAR_STATE, brandId),
    TABLE_PAGE_SIZE: buildStorageKey(STORAGE_KEY_NAMES.TABLE_PAGE_SIZE, brandId),
    AUTH_USER: buildStorageKey(STORAGE_KEY_NAMES.AUTH_USER, brandId),
    REMEMBER_EMAIL: buildStorageKey(STORAGE_KEY_NAMES.REMEMBER_EMAIL, brandId),
    PENDING_2FA: buildStorageKey(STORAGE_KEY_NAMES.PENDING_2FA, brandId),
    ACTIVATION_REQUESTS: buildStorageKey(STORAGE_KEY_NAMES.ACTIVATION_REQUESTS, brandId),
    RATE_LIMITER_ATTEMPTS: buildStorageKey(STORAGE_KEY_NAMES.RATE_LIMITER_ATTEMPTS, brandId),
  };
}

function getLegacyKeys(keyName) {
  return LEGACY_STORAGE_KEYS[keyName] ?? [];
}

export function readLocalStorage(keyName) {
  const storageKey = buildStorageKey(keyName);
  const nextValue = localStorage.getItem(storageKey);
  if (nextValue != null) return nextValue;

  for (const legacyKey of getLegacyKeys(keyName)) {
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue != null) return legacyValue;
  }

  return null;
}

export function setLocalStorage(keyName, value) {
  const storageKey = buildStorageKey(keyName);
  localStorage.setItem(storageKey, value);
  for (const legacyKey of getLegacyKeys(keyName)) {
    localStorage.removeItem(legacyKey);
  }
}

export function removeLocalStorage(keyName) {
  localStorage.removeItem(buildStorageKey(keyName));
  for (const legacyKey of getLegacyKeys(keyName)) {
    localStorage.removeItem(legacyKey);
  }
}

export { buildStorageKey };
