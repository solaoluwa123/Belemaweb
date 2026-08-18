import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getActiveBrandConfig, getAvailableBrands, setActiveBrandId } from "./brandRuntime";

const BrandContext = createContext(undefined);

function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--card-foreground", theme.cardForeground);
  root.style.setProperty("--popover", theme.popover);
  root.style.setProperty("--popover-foreground", theme.popoverForeground);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.primaryForeground);
  root.style.setProperty("--primary-hover", theme.primaryHover);
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--secondary-foreground", theme.secondaryForeground);
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--muted-foreground", theme.mutedForeground);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-foreground", theme.accentForeground);
  root.style.setProperty("--destructive", theme.destructive);
  root.style.setProperty("--destructive-foreground", theme.destructiveForeground);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--input-background", theme.inputBackground);
  root.style.setProperty("--switch-background", theme.switchBackground);
  root.style.setProperty("--ring", theme.ring);
  root.style.setProperty("--chart-1", theme.chart[0]);
  root.style.setProperty("--chart-2", theme.chart[1]);
  root.style.setProperty("--chart-3", theme.chart[2]);
  root.style.setProperty("--chart-4", theme.chart[3]);
  root.style.setProperty("--chart-5", theme.chart[4]);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--sidebar-foreground", theme.sidebarForeground);
  root.style.setProperty("--sidebar-primary", theme.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", theme.sidebarPrimaryForeground);
  root.style.setProperty("--sidebar-accent", theme.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", theme.sidebarAccentForeground);
  root.style.setProperty("--sidebar-border", theme.sidebarBorder);
  root.style.setProperty("--sidebar-ring", theme.sidebarRing);
}

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(() => getActiveBrandConfig());

  const updateBrand = (brandId, reload = false) => {
    const resolvedBrandId = setActiveBrandId(brandId, { persist: true, replaceUrl: true });
    if (reload && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    setBrand(getActiveBrandConfig(resolvedBrandId));
  };

  useEffect(() => {
    setActiveBrandId(brand.id, { persist: true, replaceUrl: true });
    applyTheme(brand.theme);
    document.title = brand.meta.documentTitle;

    window.__APP_BRANDS__ = getAvailableBrands().map((entry) => entry.id);
    window.__setAppBrand = (brandId) => {
      updateBrand(brandId, true);
    };

    return () => {
      delete window.__setAppBrand;
    };
  }, [brand]);

  const value = useMemo(
    () => ({
      brand,
      availableBrands: getAvailableBrands(),
      setBrand: updateBrand,
    }),
    [brand],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}
