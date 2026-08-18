import { BRAND_REGISTRY, DEFAULT_BRAND_ID, getBrandConfig, getAvailableBrands } from "./brandRegistry";

export const BRAND_QUERY_PARAM = "brand";
export const BRAND_STORAGE_KEY = "platform_active_brand";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeBrandId(value) {
  if (!value) return null;
  let brandId = String(value).trim().toLowerCase();
  // Legacy id from older builds
  if (brandId === "etranzact") brandId = "belema";
  return BRAND_REGISTRY[brandId] ? brandId : null;
}

export function getDefaultBrandId() {
  return normalizeBrandId(import.meta.env.VITE_BRAND) ?? DEFAULT_BRAND_ID;
}

export function readBrandIdFromLocation() {
  if (!isBrowser()) return null;
  return normalizeBrandId(new URLSearchParams(window.location.search).get(BRAND_QUERY_PARAM));
}

export function readBrandIdFromStorage() {
  if (!isBrowser()) return null;
  try {
    return normalizeBrandId(localStorage.getItem(BRAND_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolveActiveBrandId() {
  return readBrandIdFromLocation() ?? readBrandIdFromStorage() ?? getDefaultBrandId();
}

export function getActiveBrandConfig(brandId = resolveActiveBrandId()) {
  return getBrandConfig(brandId);
}

export function setActiveBrandId(brandId, options = {}) {
  const normalized = normalizeBrandId(brandId) ?? getDefaultBrandId();
  const { persist = true, replaceUrl = true } = options;

  if (isBrowser()) {
    if (persist) {
      try {
        localStorage.setItem(BRAND_STORAGE_KEY, normalized);
      } catch {
        // no-op
      }
    }

    if (replaceUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set(BRAND_QUERY_PARAM, normalized);
      window.history.replaceState({}, "", url);
    }
  }

  return normalized;
}

export { getAvailableBrands };
