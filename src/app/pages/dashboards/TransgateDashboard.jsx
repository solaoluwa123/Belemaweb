import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MetricCard } from "../../components/shared/MetricCard";
import { StatisticsSection } from "../../components/dashboard/StatisticsSection";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle,
  Loader2,
  RefreshCcw,
  Radio,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { useBrand } from "../../../branding/useBrand";
import {
  DASHBOARD_AUTO_REFRESH_MS,
  dashboardRangeIncludesToday,
  fetchAccountsDashboardData,
  formatDashboardRangeLabel,
  normalizeDashboardDateRange,
} from "../../services/dashboards";
import { APIError } from "../../services/api";
import { DashboardDateRangePicker } from "../../components/dashboard/DashboardDateRangePicker";
import { DashboardStagger, DashboardStaggerItem } from "../../components/dashboard/DashboardMotion";
import {
  isAdministrator as checkAdministrator,
  isThirdPartyVendor as checkThirdPartyVendor,
} from "../../utils/roleAccess";

const DEFAULT_STATS_RANGE = normalizeDashboardDateRange({
  start: new Date(),
  end: new Date(),
});

export default function TransgateDashboard() {
  const { user } = useAuth();
  const userRoleId = user?.roleId;
  const userInstitutionCode = user?.institutionCode;
  const userInstitutionName = user?.institutionName;
  const isVendor = useMemo(
    () => checkThirdPartyVendor(user),
    [userRoleId, userInstitutionCode, user?.roleName],
  );
  const isAdminUser = useMemo(
    () => checkAdministrator(user),
    [userRoleId, user?.roleName, isVendor],
  );
  const vendorLockedInstitution = isVendor ? userInstitutionCode || "" : "all";
  const { brand } = useBrand();
  const [statsDateRange, setStatsDateRange] = useState(() => DEFAULT_STATS_RANGE);
  const [statsInstitution, setStatsInstitution] = useState("all");
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const loadSeq = useRef(0);

  const statsRangeStartMs = statsDateRange.start.getTime();
  const statsRangeEndMs = statsDateRange.end.getTime();

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++loadSeq.current;
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage("");

      try {
        const data = await fetchAccountsDashboardData({
          institutionCode:
            isVendor
              ? userInstitutionCode || null
              : statsInstitution !== "all"
                ? statsInstitution
                : !isAdminUser
                  ? userInstitutionCode || null
                  : null,
          dateRange: statsDateRange,
          requireInstitutionScope: isVendor,
        });
        if (seq !== loadSeq.current) return;
        setStatsData(data);
        setLastUpdatedAt(new Date());
      } catch (error) {
        if (seq !== loadSeq.current) return;
        const message = error instanceof APIError ? error.message : "Unable to load dashboard data.";
        if (!silent) {
          setStatsData(null);
        }
        setErrorMessage(message);
      } finally {
        if (seq !== loadSeq.current) return;
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [statsInstitution, statsRangeStartMs, statsRangeEndMs, userInstitutionCode, userRoleId, isVendor, isAdminUser],
  );

  useEffect(() => {
    if (isVendor && userInstitutionCode) {
      setStatsInstitution(userInstitutionCode);
    }
  }, [userInstitutionCode, userRoleId, isVendor]);

  useEffect(() => {
    if (isVendor && !userInstitutionCode) {
      setIsLoading(false);
      setStatsData(null);
      setErrorMessage("Your account is not linked to an institution.");
      return;
    }
    loadDashboard();
  }, [statsInstitution, statsRangeStartMs, statsRangeEndMs, userInstitutionCode, userRoleId, loadDashboard, isVendor]);

  const isLiveRange = dashboardRangeIncludesToday(statsDateRange);

  useEffect(() => {
    if (!isLiveRange || (isVendor && !userInstitutionCode)) return undefined;
    const timer = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isLiveRange, loadDashboard, userInstitutionCode, userRoleId, isVendor]);

  const institutionFilterLabel = useMemo(() => {
    if (isVendor) {
      return userInstitutionName || userInstitutionCode || "—";
    }
    if (statsInstitution === "all") return "All institutions";
    return TRANSGATE_BANKS.find((b) => b.id === statsInstitution)?.name ?? statsInstitution;
  }, [statsInstitution, userInstitutionCode, userInstitutionName, isVendor]);

  const hasTransactions = Boolean(statsData?.hasTransactions);
  const showDashboardBody = !isLoading && !errorMessage && hasTransactions;
  const showEmptyState = !isLoading && !errorMessage && statsData != null && !hasTransactions;

  const stats = useMemo(() => {
    return (
      statsData ?? {
        metrics: {
          totalTransactions: "0",
          volume: "₦0.00",
          successRate: "0.0%",
          successCount: 0,
        },
      }
    );
  }, [statsData]);
  const { metrics } = stats;

  const successRateNum = parseFloat(String(metrics.successRate || "").replace("%", ""));
  const successTrend =
    Number.isFinite(successRateNum) && successRateNum > 0
      ? { isPositive: successRateNum >= 50, value: metrics.successRate }
      : null;

  const resetFilters = () => {
    if (!isVendor) {
      setStatsInstitution("all");
    }
    setStatsDateRange(DEFAULT_STATS_RANGE);
  };

  const filtersAreDefault =
    (isVendor || statsInstitution === "all") &&
    statsDateRange.start.getTime() === DEFAULT_STATS_RANGE.start.getTime() &&
    statsDateRange.end.getTime() === DEFAULT_STATS_RANGE.end.getTime();

  const shellSurface = brand.theme.shellSurface || "#f7faf2";

  return (
    <div
      className="-mx-5 -mt-5 min-h-[calc(100vh-4rem)] space-y-6 px-5 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:space-y-8 lg:px-8 lg:py-8"
      style={{ backgroundColor: shellSurface }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {brand.productText.accountsDashboardTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{brand.productText.accountsDashboardDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isLiveRange ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CEF445]/40 bg-[#eef8c8] px-3 py-1.5 text-xs font-medium text-[#00411A]">
              <Radio className={`h-3.5 w-3.5 ${isRefreshing ? "animate-pulse" : ""}`} aria-hidden />
              Live — {DASHBOARD_AUTO_REFRESH_MS / 1000}s
            </div>
          ) : null}
          {lastUpdatedAt ? (
            <p className="text-xs text-muted-foreground">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          ) : null}
          <Button variant="outline" onClick={() => loadDashboard()} disabled={isLoading} className="gap-2 bg-card">
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-[color:var(--border)] bg-card shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            {!isVendor ? (
              <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="toolbar-institution" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Institution
                </Label>
                <Select value={statsInstitution} onValueChange={setStatsInstitution}>
                  <SelectTrigger id="toolbar-institution" className="bg-card">
                    <SelectValue placeholder="All institutions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All institutions</SelectItem>
                    {TRANSGATE_BANKS.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="min-w-0 space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Institution
                </Label>
                <p className="text-sm font-medium text-foreground">{institutionFilterLabel}</p>
              </div>
            )}
            <DashboardDateRangePicker
              id="toolbar-date-range"
              label="Date range"
              value={statsDateRange}
              onChange={setStatsDateRange}
              className="min-w-0 sm:min-w-[260px]"
            />
            <Button
              variant="outline"
              onClick={resetFilters}
              disabled={filtersAreDefault}
              className="bg-card"
            >
              Reset
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{institutionFilterLabel}</span>
            {" · "}
            <span className="font-medium text-foreground">{formatDashboardRangeLabel(statsDateRange)}</span>
          </p>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading dashboard…
        </div>
      ) : null}

      {showEmptyState ? (
        <Card className="border-[color:var(--border)] bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ArrowLeftRight className="h-10 w-10 text-[#CEF445]" />
            <p className="text-base font-medium text-foreground">No transactions for this period</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Nothing to show for {formatDashboardRangeLabel(statsDateRange)}
              {statsInstitution !== "all" ? ` (${institutionFilterLabel})` : ""}. Pick another range or institution.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showDashboardBody ? (
        <>
          <DashboardStagger className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <DashboardStaggerItem>
              <MetricCard
                title="Transaction Volume"
                value={metrics.totalTransactions}
                icon={ArrowLeftRight}
                iconAccent="yellow"
              />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <MetricCard
                title="Transaction Value"
                value={metrics.volume}
                icon={Banknote}
                iconAccent="lime"
              />
            </DashboardStaggerItem>
            <DashboardStaggerItem>
              <MetricCard
                title="Success Rate"
                value={metrics.successRate}
                icon={CheckCircle}
                iconAccent="lime"
                subtitle={`${metrics.successCount} successful`}
                trend={successTrend}
              />
            </DashboardStaggerItem>
          </DashboardStagger>

          <StatisticsSection
            variant="analytics"
            statsDateRange={statsDateRange}
            onDateRangeChange={setStatsDateRange}
            statsInstitution={isVendor ? vendorLockedInstitution : statsInstitution}
            onInstitutionChange={setStatsInstitution}
            statsData={statsData}
            isLoading={isLoading}
            errorMessage={errorMessage}
            lockInstitution={isVendor}
            institutionDisplayName={isVendor ? userInstitutionName || userInstitutionCode : undefined}
            isLiveRange={isLiveRange}
          />
        </>
      ) : null}
    </div>
  );
}
