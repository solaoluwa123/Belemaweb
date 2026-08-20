import { Outlet, useNavigate, useLocation, Navigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { sessionManager } from "../../utils/security";
import { toast } from "sonner";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  AlertCircle,
  Users,
  Building2,
  ShieldCheck,
  Activity,
  LogOut,
  Eye,
  Banknote,
  Scale,
  ClipboardList,
  RefreshCcw,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { FaLeaf } from "react-icons/fa";
import { ETranzactWordmark } from "../branding/ETranzactWordmark";
import { useBrand } from "../../../branding/useBrand";
import { getVendorNavItems, isVendorAllowedPath } from "../../utils/transgateMenu";

const accountsMenuBase = [
  { label: "Dashboard", path: "/dashboard/accounts", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Transactions", path: "/transactions", icon: <ArrowLeftRight className="w-4 h-4" /> },
  {
    label: "Transaction Status Change",
    path: "/transactions/status-change",
    icon: <RefreshCcw className="w-4 h-4" />,
    adminRoleOnly: true,
  },
  {
    label: "Log Dispute",
    path: "/disputes/log",
    icon: <AlertCircle className="w-4 h-4" />,
    requesterOnly: true,
    hideForAdmin: true,
  },
  {
    label: "Arbitrated Disputes",
    path: "/disputes/arbitrated",
    icon: <Scale className="w-4 h-4" />,
    disputeReadAccess: true,
    hideForAdmin: true,
  },
];

const approvalsMenu = [
  { label: "Pending User Approvals", path: "/approvals/users", icon: <Users className="w-4 h-4" />, approverOnly: true },
  { label: "Wallet Approvals", path: "/approvals/wallets", icon: <Wallet className="w-4 h-4" />, approverOnly: true },
  {
    label: "Institution Approvals",
    path: "/approvals/institutions",
    icon: <Building2 className="w-4 h-4" />,
    makerCheckerApprovals: true,
  },
  {
    label: "Fund requests (queue)",
    path: "/wallets/fund",
    icon: <Banknote className="w-4 h-4" />,
    fundQueueNav: true,
  },
];

const adminMenu = [
  { label: "System Users", path: "/admin/users", icon: <Users className="w-4 h-4" />, adminOnly: true },
  { label: "Other Users", path: "/admin/other-users", icon: <Users className="w-4 h-4" />, adminOnly: true },
  { label: "Financial Institutions", path: "/admin/institutions", icon: <Building2 className="w-4 h-4" />, adminOnly: true },
  { label: "Audit Log", path: "/admin/audit-logs", icon: <ClipboardList className="w-4 h-4" />, adminRoleOnly: true },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [walletExpanded, setWalletExpanded] = useState(true);
  const [approvalsExpanded, setApprovalsExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(true);
  const wasDesktopRef = useRef(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const prevPathForSidebarRef = useRef(location.pathname);
  const { user, logout, isAdmin, isApprover, isOperator, isThirdPartyVendor, isDevBypassSession } = useAuth();
  const { brand } = useBrand();
  const accountsDashboard = brand.routes.accountsDashboard;

  const accountsMenu = accountsMenuBase.map((item, index) =>
    index === 0 ? { ...item, label: brand.menus.dashboardLabels.accounts, path: accountsDashboard } : item,
  );

  const vendorNavItems = isThirdPartyVendor()
    ? getVendorNavItems(user, { accountsDashboard }).filter((item) => isVendorAllowedPath(item.path, accountsDashboard))
    : [];
  const vendorAccountItems = vendorNavItems.filter((item) => !String(item.path).startsWith("/wallets"));
  const vendorWalletItems = vendorNavItems.filter((item) => String(item.path).startsWith("/wallets"));

  const hasRouteAccess = (pathname) => {
    if (!user) return false;
    if (isThirdPartyVendor()) {
      return isVendorAllowedPath(pathname, accountsDashboard);
    }
    if (isAdmin()) return true;
    if (pathname.startsWith("/admin/audit-logs")) return isAdmin();
    if (pathname.startsWith("/admin/")) return isOperator() || isAdmin();

    if (pathname.startsWith("/approvals/")) return isApprover() || isAdmin();

    if (pathname.startsWith("/transactions/status-change")) return isAdmin();

    if (pathname.startsWith("/disputes/arbitrated")) {
      return isApprover() || isOperator();
    }

    if (pathname === "/disputes/log" || pathname.startsWith("/disputes/log/")) {
      return isOperator() || isAdmin() || isThirdPartyVendor();
    }
    if (pathname === "/disputes" || pathname.startsWith("/disputes/")) {
      return isApprover() || isOperator() || isAdmin();
    }

    if (pathname === "/wallets/create") return isOperator() || isAdmin();

    if (pathname.startsWith("/wallets/fund/review/")) return isApprover() || isOperator() || isAdmin();
    if (pathname.startsWith("/wallets/fund")) return isOperator() || isApprover() || isAdmin();

    return true;
  };

  useEffect(() => {
    if (user && user.mustChangePassword && location.pathname !== "/auth/force-password-change") {
      navigate("/auth/force-password-change", { replace: true });
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (!user) return;
    sessionManager.start(() => {
      logout();
      navigate("/login", { replace: true });
      toast.error("Session expired due to inactivity.");
    });
    return () => {
      sessionManager.stop();
    };
  }, [user, logout, navigate]);

  useEffect(() => {
    if (!user) return;
    if (!hasRouteAccess(location.pathname)) {
      navigate("/", { replace: true });
      toast.error("You are not authorized to access this page.");
    }
  }, [location.pathname, user, navigate, isAdmin, isApprover, isOperator, isThirdPartyVendor]);

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024;
      if (desktop !== wasDesktopRef.current) {
        wasDesktopRef.current = desktop;
        setSidebarOpen(desktop);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** Close drawer after any in-app navigation (all viewports). Skip first run so large screens stay default-open. */
  useEffect(() => {
    if (prevPathForSidebarRef.current !== location.pathname) {
      prevPathForSidebarRef.current = location.pathname;
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sidebarOpen]);

  if (user == null) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActivePath = (path) => {
    if (path === "/wallets/fund") {
      return location.pathname.startsWith("/wallets/fund");
    }
    if (location.pathname === path) return true;
    if (path === accountsDashboard) {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return false;
  };

  const walletNav = {
    view: location.pathname === "/wallets" || location.pathname === "/wallets/create",
    activities:
      location.pathname === "/wallets/activities" || /^\/wallets\/[^/]+\/activity$/.test(location.pathname),
    fund: location.pathname.startsWith("/wallets/fund"),
  };

  const institutionActivityActive = location.pathname.startsWith("/wallets/institution-activity");

  const isVendorItemActive = (path) => {
    if (path === "/wallets") return walletNav.view;
    if (path === "/wallets/activities") return walletNav.activities;
    if (path === "/disputes/log") return location.pathname === "/disputes/log";
    if (path === "/disputes/arbitrated") return location.pathname.startsWith("/disputes/arbitrated");
    if (path === "/disputes") {
      return (
        location.pathname === "/disputes" ||
        (location.pathname.startsWith("/disputes/") &&
          !location.pathname.startsWith("/disputes/log") &&
          !location.pathname.startsWith("/disputes/arbitrated"))
      );
    }
    return location.pathname === path || (path !== accountsDashboard && location.pathname.startsWith(`${path}/`));
  };

  const navigateTo = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const filterMenuByRole = (items) => {
    return items.filter((item) => {
      if (item.adminRoleOnly && !isAdmin()) return false;
      if (item.adminOnly && !isOperator() && !isAdmin()) return false;
      if (item.disputeReadAccess && !isApprover() && !isOperator() && !isAdmin()) return false;
      if (item.makerCheckerApprovals && !isApprover() && !isAdmin()) return false;
      if (item.approverOnly && !isApprover() && !isAdmin()) return false;
      if (item.fundQueueNav && (!isApprover() || isAdmin())) return false;
      if (item.requesterOnly && !isOperator() && !isAdmin()) return false;
      if (item.hideForAdmin && isAdmin()) return false;
      return true;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 lg:w-64 lg:max-w-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <FaLeaf className="absolute left-3 top-16 text-5xl rotate-[-18deg]" style={{ color: brand.theme.leafPrimary }} />
          <FaLeaf className="absolute right-4 top-28 text-4xl rotate-[28deg]" style={{ color: brand.theme.leafSecondary }} />
          <FaLeaf className="absolute left-6 top-1/2 text-6xl rotate-[14deg]" style={{ color: brand.theme.leafTertiary }} />
          <FaLeaf className="absolute right-3 bottom-28 text-5xl rotate-[-20deg]" style={{ color: brand.theme.leafPrimary }} />
          <FaLeaf className="absolute left-8 bottom-10 text-4xl rotate-[36deg]" style={{ color: brand.theme.leafSecondary }} />
        </div>

        <div className="relative z-10 border-b border-sidebar-border p-4">
          <div className="flex items-start justify-between gap-2">
            <ETranzactWordmark
              compact
              showSubtitle
              subtitle={brand.productText.shellSubtitle}
              className="text-sidebar-foreground min-w-0 flex-1"
              textClassName="text-[1.8rem] text-sidebar-accent-foreground"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="relative z-10 border-b border-sidebar-border bg-sidebar-accent p-4">
          <p className="text-sm font-medium">{user?.username}</p>
          <p className="text-xs text-sidebar-accent-foreground">{user?.roleName}</p>
          <p className="mt-1 text-xs text-sidebar-accent-foreground/80">{user?.institutionName}</p>
        </div>

        <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {isThirdPartyVendor() ? (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => setAccountsExpanded(!accountsExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
                >
                  <span>{brand.menus.groupLabels.accounts.toUpperCase()}</span>
                  {accountsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {accountsExpanded ? (
                  <div className="mt-1 space-y-1">
                    {vendorAccountItems.map((item) => {
                      const Icon = item.icon || LayoutDashboard;
                      const active = isVendorItemActive(item.path);
                      return (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => navigateTo(item.path)}
                          className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setWalletExpanded(!walletExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
                >
                  <span>{brand.menus.groupLabels.wallet.toUpperCase()}</span>
                  {walletExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {walletExpanded ? (
                  <div className="mt-1 space-y-1">
                    {vendorWalletItems.map((item) => {
                      const Icon = item.icon || LayoutDashboard;
                      const active = isVendorItemActive(item.path);
                      return (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => navigateTo(item.path)}
                          className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <p className="mt-6 px-3 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground/75">
                {brand.productText.sidebarBelowNavLabel ?? brand.displayName}
              </p>
            </>
          ) : (
            <>
          <button
            type="button"
            onClick={() => navigateTo("/wallets/institution-activity")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              institutionActivityActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Institution activity
          </button>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAccountsExpanded(!accountsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
            >
              <span>{brand.menus.groupLabels.accounts.toUpperCase()}</span>
              {accountsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accountsExpanded && (
              <div className="mt-1 space-y-1">
                {filterMenuByRole(accountsMenu).map((item) => (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isActivePath(item.path)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setWalletExpanded(!walletExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
            >
              <span>{brand.menus.groupLabels.wallet.toUpperCase()}</span>
              {walletExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {walletExpanded && (
              <div className="mt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => navigateTo("/wallets")}
                  className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    walletNav.view ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="min-w-0 flex-1 truncate">Wallets</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("/wallets/activities")}
                  className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    walletNav.activities ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="min-w-0 flex-1 truncate">Wallet activities</span>
                </button>
                {(isOperator() || isAdmin()) && (
                  <button
                    type="button"
                    onClick={() => navigateTo("/wallets/fund")}
                    className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      walletNav.fund ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="min-w-0 flex-1 truncate">Fund wallet</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {(isApprover() || isAdmin()) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setApprovalsExpanded(!approvalsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
              >
                <span>{brand.menus.groupLabels.approvals.toUpperCase()}</span>
                {approvalsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {approvalsExpanded && (
                <div className="mt-1 space-y-1">
                  {filterMenuByRole(approvalsMenu).map((item) => (
                    <button
                      type="button"
                      key={item.path}
                      onClick={() => navigateTo(item.path)}
                      className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isActivePath(item.path)
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(isOperator() || isAdmin()) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground hover:text-sidebar-foreground"
              >
                <span>{brand.menus.groupLabels.administration.toUpperCase()}</span>
                {adminExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {adminExpanded && (
                <div className="mt-1 space-y-1">
                  {filterMenuByRole(adminMenu).map((item) => (
                    <button
                      type="button"
                      key={item.path}
                      onClick={() => navigateTo(item.path)}
                      className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isActivePath(item.path)
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="mt-6 px-3 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-accent-foreground/75">
            {brand.productText.sidebarBelowNavLabel ?? brand.displayName}
          </p>
            </>
          )}
        </nav>
      </aside>

      <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {!sidebarOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            ) : (
              <span className="w-10 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <ETranzactWordmark compact textClassName="text-[1.25rem] sm:text-[1.6rem]" />
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
            {user?.has2FA && (
              <div className="hidden items-center gap-2 text-sm text-green-600 sm:flex">
                <ShieldCheck className="w-4 h-4" />
                2FA Enabled
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex min-w-0 items-center gap-2 border-border px-2 sm:px-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
                    {user?.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[110px] truncate text-sm sm:max-w-[180px]">{user?.username}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">{user?.institutionName}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigateTo("/settings/security")}>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Security / 2FA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-5 sm:p-6 lg:p-8">
          {isDevBypassSession() ? (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Development mode: signed in as Third Party Vendor without API login. Set{" "}
              <code className="rounded bg-amber-100 px-1">VITE_DEV_VENDOR_AUTH_TOKEN</code> if API calls need a real
              session token.
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      {/* After main column so it stacks above page content; backdrop z-40 stays below aside z-50 */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        role="presentation"
        aria-hidden={!sidebarOpen}
      />
    </div>
  );
}
