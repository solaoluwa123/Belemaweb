function createWordmarkDataUrl(name, primary, accent, tagline) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80" role="img" aria-label="${name}">
      <rect width="360" height="80" rx="18" fill="white"/>
      <circle cx="38" cy="40" r="20" fill="${accent}" opacity="0.18"/>
      <path d="M31 51V29h10c9 0 14 3.8 14 10.8 0 7.4-5.8 11.2-14.5 11.2H31zm9-7h1.2c3.6 0 6.4-1.3 6.4-4.5 0-3.1-2.6-4.4-6.4-4.4H40V44z" fill="${accent}"/>
      <text x="72" y="49" font-size="34" font-family="Segoe UI, Arial, sans-serif" font-weight="700" fill="${primary}">${name}</text>
      <text x="74" y="67" font-size="10" font-family="Segoe UI, Arial, sans-serif" letter-spacing="2.3" fill="${accent}">${tagline}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const wordmark = createWordmarkDataUrl("SwitchVista", "#0d3c3a", "#f59f0a", "Realtime Clearing Hub");

export const switchvistaBrand = {
  id: "switchvista",
  displayName: "SwitchVista",
  shortName: "SwitchVista",
  tagline: "Realtime Clearing Hub",
  meta: {
    documentTitle: "SwitchVista Financial Platform",
  },
  logos: {
    wordmark,
    icon: wordmark,
    alt: "SwitchVista",
  },
  images: {},
  routes: {
    accountsDashboard: "/dashboard/accounts",
    liveMonitoring: "/dashboard/live-monitoring",
  },
  menus: {
    groupLabels: {
      accounts: "Operations",
      wallet: "Wallet",
      approvals: "Approvals",
      administration: "Administration",
    },
    dashboardLabels: {
      accounts: "SwitchVista Dashboard",
    },
  },
  productText: {
    shellSubtitle: "Realtime Clearing Hub",
    /** Shown at the bottom of the main sidebar nav (below Administration). */
    sidebarBelowNavLabel: "SwitchVista",
    accountsDashboardTitle: "Operations Dashboard",
    accountsDashboardDescription: "Cross-bank transaction monitoring and settlement analytics",
    loginHeading: "Log in",
    activationPrompt: "Activate account",
  },
  theme: {
    background: "#ffffff",
    foreground: "#1f2937",
    card: "#ffffff",
    cardForeground: "#1f2937",
    popover: "#ffffff",
    popoverForeground: "#1f2937",
    primary: "#0d3c3a",
    primaryForeground: "#ffffff",
    primaryHover: "#14524f",
    secondary: "#eef8f6",
    secondaryForeground: "#0d3c3a",
    muted: "#f5fbfa",
    mutedForeground: "#5b6e6d",
    accent: "#d7efec",
    accentForeground: "#0d3c3a",
    destructive: "#d4183d",
    destructiveForeground: "#ffffff",
    border: "#cfe3df",
    inputBackground: "#f8fcfb",
    switchBackground: "#b9d8d2",
    ring: "#169a8f",
    chart: ["#0d3c3a", "#169a8f", "#f59f0a", "#d65252", "#6cc7c0"],
    sidebar: "#0d3c3a",
    sidebarForeground: "#ffffff",
    sidebarPrimary: "#169a8f",
    sidebarPrimaryForeground: "#ffffff",
    sidebarAccent: "#14524f",
    sidebarAccentForeground: "#d7f4ef",
    sidebarBorder: "#23615d",
    sidebarRing: "#169a8f",
    shellSurface: "#f5fbfa",
    loginSurface: "#edf8f6",
    authPanelFrom: "#ffffff",
    authPanelVia: "#f4fbfa",
    authPanelTo: "#e2f2ef",
    leafPrimary: "rgba(22, 154, 143, 0.12)",
    leafSecondary: "rgba(245, 159, 10, 0.12)",
    leafTertiary: "rgba(13, 60, 58, 0.08)",
  },
  api: {
    baseUrlFallback: "https://api.switchvista.example",
  },
  mockBrand: {
    institutionName: "SwitchVista",
    organizationName: "SwitchVista Operations",
    testEnvironmentName: "SwitchVista Test Environment",
    emailDomain: "switchvista.demo",
    backupCodesFileName: "switchvista-backup-codes.txt",
    backupCodesLabel: "SwitchVista - Backup codes (single use)",
    users: [
      {
        id: "U001",
        username: "admin_user",
        email: "admin@switchvista.demo",
        password: "Admin@123",
        phone: "+234 800 000 1001",
        roleName: "Admin",
        status: "Active",
        mustChangePassword: false,
      },
      {
        id: "U002",
        username: "approval_user",
        email: "approver@switchvista.demo",
        password: "Approver@123",
        phone: "+234 800 000 1002",
        roleName: "Approver",
        status: "Active",
        mustChangePassword: false,
      },
      {
        id: "U003",
        username: "ops_user",
        email: "operator@switchvista.demo",
        password: "Operator@123",
        phone: "+234 800 000 1003",
        roleName: "Operator",
        status: "Active",
        mustChangePassword: false,
      },
    ],
  },
};
