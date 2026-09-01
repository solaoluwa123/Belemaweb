import logoLight from "../../../assets/belema/logo-light.png";
import logoDark from "../../../assets/belema/logo-dark.png";
import logoMarkLight from "../../../assets/belema/logo-mark-light.png";
import logoMarkDark from "../../../assets/belema/logo-mark-dark.png";
import pattern from "../../../assets/belema/pattern.png";

export const belemaBrand = {
  id: "belema",
  displayName: "BelemaFintech",
  shortName: "Belema",
  tagline: "...promoting financial Inclusion...",
  meta: {
    documentTitle: "BelemaFintech — Switching Platform",
  },
  logos: {
    /** Full wordmark on light surfaces (dark green type). */
    wordmark: logoDark,
    wordmarkDark: logoDark,
    /** Full wordmark on dark surfaces (lime type). */
    wordmarkLight: logoLight,
    /** Icon-only marks. */
    icon: logoMarkDark,
    iconDark: logoMarkDark,
    iconLight: logoMarkLight,
    alt: "BelemaFintech",
  },
  images: {
    pattern,
  },
  routes: {
    accountsDashboard: "/dashboard/accounts",
    liveMonitoring: "/dashboard/live-monitoring",
  },
  dashboard: {
    /** FT processing-time SLA target shown on avg-time cards (seconds). */
    ftTargetSeconds: 3,
  },
  menus: {
    groupLabels: {
      accounts: "Accounts",
      wallet: "Wallet",
      approvals: "Approvals",
      administration: "Administration",
    },
    dashboardLabels: {
      accounts: "Dashboard",
    },
  },
  productText: {
    shellSubtitle: "Switching Platform",
    /** Shown at the bottom of the main sidebar nav (below Administration). */
    sidebarBelowNavLabel: "Belema",
    accountsDashboardTitle: "Operations Dashboard",
    accountsDashboardDescription: "Account-based transaction monitoring and analytics",
    loginHeading: "Log in",
    activationPrompt: "Activate account",
  },
  /** Official Belema primary palette (Brand colors.png). */
  palette: {
    brandGreen: "#00411A",
    lime: "#CEF445",
    yellow: "#FFD600",
    burgundy: "#410027",
    orange: "#E84A25",
  },
  theme: {
    background: "#ffffff",
    foreground: "#1f2937",
    card: "#ffffff",
    cardForeground: "#1f2937",
    popover: "#ffffff",
    popoverForeground: "#1f2937",
    /** Primary CTAs — yellow with black label text (matches brand login mockup). */
    primary: "#FFD600",
    primaryForeground: "#000000",
    primaryHover: "#E6C200",
    /** Secondary accents — burgundy enterprise tone. */
    secondary: "#f5eef2",
    secondaryForeground: "#410027",
    muted: "#f7faf2",
    mutedForeground: "#475569",
    /** Micro-interactions / friendly prompts — orange. */
    accent: "#fff0eb",
    accentForeground: "#E84A25",
    destructive: "#d4183d",
    destructiveForeground: "#ffffff",
    border: "#dce8c8",
    inputBackground: "#fafdf5",
    switchBackground: "#CEF445",
    ring: "#00411A",
    chart: ["#00411A", "#CEF445", "#FFD600", "#410027", "#E84A25"],
    /** Navigation — dark green shell. */
    sidebar: "#00411A",
    sidebarForeground: "#ffffff",
    sidebarPrimary: "#CEF445",
    sidebarPrimaryForeground: "#00411A",
    sidebarAccent: "#005a24",
    sidebarAccentForeground: "#e8f5e9",
    sidebarBorder: "#003014",
    sidebarRing: "#CEF445",
    shellSurface: "#f7faf2",
    loginSurface: "#e5f7a8",
    loginHero: "#00411A",
    loginPrimary: "#00411A",
    authPanelFrom: "#fafdf5",
    authPanelVia: "#f0f9d4",
    authPanelTo: "#e8f5a0",
    leafPrimary: "rgba(206, 244, 69, 0.22)",
    leafSecondary: "rgba(0, 65, 26, 0.18)",
    leafTertiary: "rgba(255, 214, 0, 0.16)",
  },
  api: {
    baseUrlFallback: "http://localhost:8077/sparkpayapi",
  },
  mockBrand: {
    institutionName: "Belema Financial Technology Limited",
    organizationName: "Belema Operations",
    testEnvironmentName: "Belema Test Environment",
    emailDomain: "belema.ng",
    backupCodesFileName: "belema-backup-codes.txt",
    backupCodesLabel: "Belema - Backup codes (single use)",
    users: [
      {
        id: "U001",
        username: "admin_user",
        email: "admin@belema.ng",
        password: "Admin@123",
        phone: "+234 800 000 0001",
        roleName: "Admin",
        status: "Active",
        mustChangePassword: false,
      },
      {
        id: "U002",
        username: "approval_user",
        email: "approver@belema.ng",
        password: "Approver@123",
        phone: "+234 800 000 0002",
        roleName: "Approver",
        status: "Active",
        mustChangePassword: false,
      },
      {
        id: "U003",
        username: "ops_user",
        email: "operator@belema.ng",
        password: "Operator@123",
        phone: "+234 800 000 0003",
        roleName: "Operator",
        status: "Active",
        mustChangePassword: false,
      },
    ],
  },
};
