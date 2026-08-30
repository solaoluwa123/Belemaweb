import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MetricCard } from "../../components/shared/MetricCard";
import { StatisticsSection } from "../../components/dashboard/StatisticsSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle,
  Filter,
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
import {
  DashboardDateRangePicker,
  dashboardRangeSummary,
} from "../../components/dashboard/DashboardDateRangePicker";

const DEFAULT_STATS_RANGE = normalizeDashboardDateRange({
  start: new Date(),
  end: new Date(),
});

export default function TransgateDashboard() {
  const { user, isAdmin, isThirdPartyVendor } = useAuth();
  const vendorLockedInstitution = isThirdPartyVendor() ? user?.institutionCode || "" : "all";
  const { brand } = useBrand();
  const [statsDateRange, setStatsDateRange] = useState(() => DEFAULT_STATS_RANGE);
  const [statsInstitution, setStatsInstitution] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalInstitution, setModalInstitution] = useState("all");
  const [modalDateRange, setModalDateRange] = useState(() => DEFAULT_STATS_RANGE);
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const loadSeq = useRef(0);

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
            isThirdPartyVendor()
              ? user?.institutionCode || null
              : statsInstitution !== "all"
                ? statsInstitution
                : !isAdmin()
                  ? user?.institutionCode || null
                  : null,
          dateRange: statsDateRange,
          requireInstitutionScope: isThirdPartyVendor(),
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
    [statsInstitution, statsDateRange, user?.institutionCode, user?.roleId, isThirdPartyVendor, isAdmin],
  );

  useEffect(() => {
    if (isThirdPartyVendor() && user?.institutionCode) {
      setStatsInstitution(user.institutionCode);
      setModalInstitution(user.institutionCode);
    }
  }, [user?.institutionCode, user?.roleId]);

  useEffect(() => {
    if (isThirdPartyVendor() && !user?.institutionCode) {
      setIsLoading(false);
      setStatsData(null);
      setErrorMessage("Your account is not linked to an institution.");
      return;
    }
    loadDashboard();
  }, [statsInstitution, statsDateRange, user?.institutionCode, user?.roleId, loadDashboard]);

  const isLiveRange = dashboardRangeIncludesToday(statsDateRange);

  useEffect(() => {
    if (!isLiveRange || (isThirdPartyVendor() && !user?.institutionCode)) return undefined;
    const timer = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isLiveRange, loadDashboard, user?.institutionCode, user?.roleId]);

  const institutionFilterLabel = useMemo(() => {
    if (isThirdPartyVendor()) {
      return user?.institutionName || user?.institutionCode || "—";
    }
    if (statsInstitution === "all") return "All";
    return TRANSGATE_BANKS.find((b) => b.id === statsInstitution)?.name ?? statsInstitution;
  }, [statsInstitution, user?.institutionCode, user?.institutionName, user?.roleId]);

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

  const openFilters = () => {
    setModalInstitution(statsInstitution);
    setModalDateRange(statsDateRange);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatsInstitution(isThirdPartyVendor() ? user?.institutionCode || "" : modalInstitution);
    setStatsDateRange(normalizeDashboardDateRange(modalDateRange));
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    if (!isThirdPartyVendor()) {
      setModalInstitution("all");
      setStatsInstitution("all");
    }
    setModalDateRange(DEFAULT_STATS_RANGE);
    setStatsDateRange(DEFAULT_STATS_RANGE);
    setFiltersOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{brand.productText.accountsDashboardTitle}</h1>
          <p className="mt-1 text-gray-500">{brand.productText.accountsDashboardDescription}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {isLiveRange ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CEF445]/40 bg-[#eef8c8] px-3 py-1.5 text-xs font-medium text-[#00411A]">
              <Radio className={`h-3.5 w-3.5 ${isRefreshing ? "animate-pulse" : ""}`} aria-hidden />
              Live — refreshes every {DASHBOARD_AUTO_REFRESH_MS / 1000}s
            </div>
          ) : null}
          {lastUpdatedAt ? (
            <p className="text-xs text-gray-500">
              Updated {lastUpdatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          ) : null}
          <Button variant="outline" onClick={() => loadDashboard()} disabled={isLoading} className="gap-2">
            {isLoading || isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-gray-200">
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Filter dashboard by institution and date range. Current:{" "}
              <span className="font-medium text-gray-900">
                {institutionFilterLabel} • {dashboardRangeSummary(statsDateRange)}
              </span>
            </p>
            <Button onClick={openFilters} variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Dashboard filters</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isThirdPartyVendor() ? (
              <div className="space-y-2">
                <Label htmlFor="filter-institution">Source financial institution</Label>
                <Select value={modalInstitution} onValueChange={setModalInstitution}>
                  <SelectTrigger id="filter-institution">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSGATE_BANKS.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Institution: <span className="font-medium">{user?.institutionName || vendorLockedInstitution}</span>
              </p>
            )}
            <DashboardDateRangePicker
              id="filter-date-range"
              value={modalDateRange}
              onChange={setModalDateRange}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={applyFilters}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-16 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading dashboard…
        </div>
      ) : null}

      {showEmptyState ? (
        <Card className="border-gray-200">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ArrowLeftRight className="h-10 w-10 text-gray-300" />
            <p className="text-base font-medium text-gray-900">No transactions for this period</p>
            <p className="max-w-md text-sm text-gray-600">
              Nothing to show for {formatDashboardRangeLabel(statsDateRange)}
              {statsInstitution !== "all" ? ` (${institutionFilterLabel})` : ""}. Pick another range or institution.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showDashboardBody ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Transaction Volume"
              value={metrics.totalTransactions}
              icon={ArrowLeftRight}
              iconColor="text-primary"
            />
            <MetricCard
              title="Transaction Value"
              value={metrics.volume}
              icon={Banknote}
              iconColor="text-[color:var(--color-chart-2)]"
            />
            <MetricCard
              title="Success Rate"
              value={metrics.successRate}
              icon={CheckCircle}
              iconColor="text-[color:var(--color-chart-2)]"
              subtitle={`${metrics.successCount} successful`}
            />
          </div>

          <StatisticsSection
            statsDateRange={statsDateRange}
            onDateRangeChange={setStatsDateRange}
            statsInstitution={isThirdPartyVendor() ? vendorLockedInstitution : statsInstitution}
            onInstitutionChange={setStatsInstitution}
            statsData={statsData}
            isLoading={isLoading}
            errorMessage={errorMessage}
            lockInstitution={isThirdPartyVendor()}
            institutionDisplayName={isThirdPartyVendor() ? user?.institutionName || user?.institutionCode : undefined}
            isLiveRange={isLiveRange}
          />
        </>
      ) : null}
    </div>
  );
}
