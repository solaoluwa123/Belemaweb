import { belemaBrand } from "./brands/belema";
import { etranzactBrand } from "./brands/etranzact";
import { switchvistaBrand } from "./brands/switchvista";

export const DEFAULT_BRAND_ID = "belema";

export const BRAND_REGISTRY = {
  [belemaBrand.id]: belemaBrand,
  [etranzactBrand.id]: etranzactBrand,
  [switchvistaBrand.id]: switchvistaBrand,
};

export function getBrandConfig(brandId) {
  return BRAND_REGISTRY[brandId] ?? BRAND_REGISTRY[DEFAULT_BRAND_ID];
}

export function getAvailableBrands() {
  // Hide legacy etranzact id from brand switchers; display is Belema.
  return Object.values(BRAND_REGISTRY).filter((brand) => brand.id !== "etranzact");
}
