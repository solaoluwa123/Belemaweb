import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  AlertCircle,
  Scale,
  Banknote,
  Activity,
  Eye,
} from "lucide-react";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  layoutdashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  arrowleftright: ArrowLeftRight,
  wallet: Wallet,
  wallets: Wallet,
  eye: Eye,
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
  ["/wallets/activities", "/wallets/activities"],
  ["/wallets/view", "/wallets"],
  ["/wallets", "/wallets"],
  ["/statistics", "/dashboard/statistics"],
];

const EXACT_ONLY_ALIASES = new Set(["/wallets", "/disputes", "/transactions"]);

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
    const exact = normalized === from;
    const prefix = !EXACT_ONLY_ALIASES.has(from) && normalized.startsWith(`${from}/`);
    if (exact || prefix) {
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
  if (!key) return null;
  if (key.startsWith("fa") && key.length <= 4) return null;
  return ICON_MAP[key] || null;
}

function resolveIconForPath(path, iconName) {
  const p = String(path || "");
  if (p === "/wallets/activities" || p.startsWith("/wallets/activit")) return Activity;
  if (p === "/wallets" || p.startsWith("/wallets/")) return Eye;
  if (p === "/disputes/log" || p.startsWith("/disputes/log")) return AlertCircle;
  if (p.startsWith("/disputes")) return Scale;
  if (p.startsWith("/transactions")) return ArrowLeftRight;
  if (p.includes("/dashboard") || p === "/") return LayoutDashboard;
  return resolveIcon(iconName) || LayoutDashboard;
}

function isCardMenuPath(path) {
  return CARD_PATH_RE.test(String(path || ""));
}

function itemLabel(row) {
  return String(row?.label || row?.childLabel || "").trim();
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
    if (!isVendorAllowedPath(route, accountsDashboard)) continue;

    const label = itemLabel(row);
    if (!label) continue;

    seen.add(route);
    items.push({
      label,
      path: route,
      icon: resolveIconForPath(route, row.icon),
    });
  }

  return items;
}

/** Fallback when API returns no Transgate menu rows. */
export function getVendorFallbackMenu({ accountsDashboard = "/dashboard/accounts" } = {}) {
  return [
    { label: "Dashboard", path: accountsDashboard, icon: LayoutDashboard },
    { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
    { label: "Wallets", path: "/wallets", icon: Eye },
    { label: "Wallet Activities", path: "/wallets/activities", icon: Activity },
    { label: "Log Dispute", path: "/disputes/log", icon: AlertCircle },
  ];
}

export function getVendorNavItems(user, { accountsDashboard = "/dashboard/accounts" } = {}) {
  const fallback = getVendorFallbackMenu({ accountsDashboard }).filter((item) =>
    isVendorAllowedPath(item.path, accountsDashboard),
  );
  const fromApi = buildNavFromTransgateMenu(user?.transgateMenu, { accountsDashboard });
  const byPath = new Map(fallback.map((item) => [item.path, { ...item }]));

  for (const item of fromApi) {
    const existing = byPath.get(item.path);
    if (existing) {
      byPath.set(item.path, {
        ...existing,
        label: item.label || existing.label,
        icon: item.icon || existing.icon,
      });
    } else if (isVendorAllowedPath(item.path, accountsDashboard)) {
      byPath.set(item.path, item);
    }
  }

  const ordered = [];
  const seen = new Set();
  for (const item of fallback) {
    const next = byPath.get(item.path);
    if (next) {
      ordered.push(next);
      seen.add(item.path);
    }
  }
  for (const [path, item] of byPath) {
    if (!seen.has(path)) ordered.push(item);
  }
  return ordered;
}

/** Paths a Third Party Vendor may access (for route guards). */
export const VENDOR_ALLOWED_ROUTE_PREFIXES = [
  "/dashboard/accounts",
  "/dashboard/transgate",
  "/",
  "/transactions",
  "/wallets",
  "/auth/",
];

export function isVendorAllowedPath(pathname, accountsDashboard = "/dashboard/accounts") {
  if (pathname === "/" || pathname === accountsDashboard) return true;
  if (pathname.startsWith("/dashboard/statistics")) return true;
  if (pathname.startsWith("/settings/security")) return true;
  if (pathname.startsWith("/dashboard/live-monitoring")) return true;
  if (pathname.startsWith("/transactions/status-change")) return false;
  if (pathname.startsWith("/transactions/tsq-retry")) return false;
  // Vendors: Log Dispute only — not list, arbitrated, or other dispute routes.
  if (pathname === "/disputes/log" || pathname.startsWith("/disputes/log/")) return true;
  if (pathname === "/disputes" || pathname.startsWith("/disputes/")) return false;
  if (pathname.startsWith("/wallets/institution-activity")) return false;
  if (pathname.startsWith("/admin/")) return false;
  if (pathname.startsWith("/approvals/")) return false;
  if (pathname === "/wallets/create" || pathname.startsWith("/wallets/fund")) return false;

  return VENDOR_ALLOWED_ROUTE_PREFIXES.some((prefix) => {
    if (prefix === "/") return pathname === "/";
    return pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix);
  });
}
