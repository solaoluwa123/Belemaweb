import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  AlertCircle,
  Scale,
  Banknote,
  Activity,
} from "lucide-react";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  layoutdashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  arrowleftright: ArrowLeftRight,
  wallet: Wallet,
  wallets: Wallet,
  dispute: AlertCircle,
  disputes: AlertCircle,
  alertcircle: AlertCircle,
  arbitrated: Scale,
  scale: Scale,
  settlement: Banknote,
  settlements: Banknote,
  banknote: Banknote,
  activity: Activity,
  monitoring: Activity,
};

const PATH_ALIASES = [
  ["/dashboard/transgate", "/dashboard/accounts"],
  ["/transactions/dashboard", "/dashboard/accounts"],
  ["/transactions", "/transactions"],
  ["/disputes/log", "/disputes/log"],
  ["/disputes/create", "/disputes/log"],
  ["/disputes/list", "/disputes"],
  ["/disputes/arbitrated", "/disputes/arbitrated"],
  ["/disputes", "/disputes"],
  ["/wallets/activity", "/wallets/activities"],
  ["/wallets/view", "/wallets"],
  ["/wallets", "/wallets"],
  ["/statistics", "/dashboard/statistics"],
];

const CARD_PATH_RE = /\/cards?\b|\/cardpayments|\/nuspayments|\/sparkpay/i;

function normalizePath(raw) {
  const p = String(raw || "").trim();
  if (!p) return "";
  if (p.startsWith("http")) return "";
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

export function resolveMenuPath(rawPath, accountsDashboard = "/dashboard/accounts") {
  const normalized = normalizePath(rawPath);
  if (!normalized) return "";

  if (normalized === "/" || normalized === "/dashboard") {
    return accountsDashboard;
  }

  for (const [from, to] of PATH_ALIASES) {
    if (normalized === from || normalized.startsWith(`${from}/`)) {
      if (to === "/dashboard/accounts") return accountsDashboard;
      return to;
    }
  }

  return normalized;
}

function resolveIcon(iconName) {
  const key = String(iconName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ICON_MAP[key] || LayoutDashboard;
}

function isCardMenuPath(path) {
  return CARD_PATH_RE.test(String(path || ""));
}

/**
 * Build flat nav items for Third Party Vendor from login transgateMenu.
 */
export function buildNavFromTransgateMenu(transgateMenu, { accountsDashboard = "/dashboard/accounts" } = {}) {
  const rows = Array.isArray(transgateMenu) ? transgateMenu : [];
  const seen = new Set();
  const items = [];

  for (const row of rows) {
    const rawPath = row.path || row.childPath || "";
    if (isCardMenuPath(rawPath)) continue;

    const route = resolveMenuPath(rawPath, accountsDashboard);
    if (!route || seen.has(route)) continue;
    seen.add(route);

    const Icon = resolveIcon(row.icon);
    items.push({
      label: row.label || row.childLabel || "Menu",
      path: route,
      icon: Icon,
    });
  }

  return items;
}

/** Fallback when API returns no Transgate menu rows. */
export function getVendorFallbackMenu({ accountsDashboard = "/dashboard/accounts" } = {}) {
  return [
    { label: "Dashboard", path: accountsDashboard, icon: LayoutDashboard },
    { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
    { label: "Log Dispute", path: "/disputes/log", icon: AlertCircle },
    { label: "Disputes", path: "/disputes", icon: Scale },
    { label: "Wallets", path: "/wallets", icon: Wallet },
    { label: "Wallet Activities", path: "/wallets/activities", icon: Wallet },
  ];
}

export function getVendorNavItems(user, { accountsDashboard = "/dashboard/accounts" } = {}) {
  const fromApi = buildNavFromTransgateMenu(user?.transgateMenu, { accountsDashboard });
  if (fromApi.length) return fromApi;
  return getVendorFallbackMenu({ accountsDashboard });
}

/** Paths a Third Party Vendor may access (for route guards). */
export const VENDOR_ALLOWED_ROUTE_PREFIXES = [
  "/dashboard/accounts",
  "/dashboard/transgate",
  "/",
  "/transactions",
  "/disputes",
  "/wallets",
  "/auth/",
];

export function isVendorAllowedPath(pathname, accountsDashboard = "/dashboard/accounts") {
  if (pathname === "/" || pathname === accountsDashboard) return true;
  if (pathname.startsWith("/dashboard/statistics")) return true;
  if (pathname.startsWith("/dashboard/live-monitoring")) return false;
  if (pathname.startsWith("/wallets/institution-activity")) return false;
  if (pathname.startsWith("/admin/")) return false;
  if (pathname.startsWith("/approvals/")) return false;
  if (pathname === "/wallets/create" || pathname.startsWith("/wallets/fund")) return false;

  return VENDOR_ALLOWED_ROUTE_PREFIXES.some((prefix) => {
    if (prefix === "/") return pathname === "/";
    return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix);
  });
}
