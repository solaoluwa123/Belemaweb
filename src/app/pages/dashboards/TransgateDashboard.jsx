import { useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Calendar, CALENDAR_YEAR_MIN, CALENDAR_YEAR_MAX } from "../../components/ui/calendar";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle,
  Filter,
  CalendarIcon,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { useBrand } from "../../../branding/useBrand";
import { fetchAccountsDashboardData } from "../../services/dashboards";
import { APIError } from "../../services/api";

/** Default to today so the dashboard loads the current calendar day. */
const DEFAULT_STATS_DATE = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export default function TransgateDashboard() {
  const { user, isAdmin, isThirdPartyVendor } = useAuth();
  const vendorLockedInstitution = isThirdPartyVendor() ? user?.institutionCode || "" : "all";
  const { brand } = useBrand();
  const [statsDate, setStatsDate] = useState(() => DEFAULT_STATS_DATE);
  const [statsInstitution, setStatsInstitution] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalInstitution, setModalInstitution] = useState("all");
  const [modalDate, setModalDate] = useState(() => DEFAULT_STATS_DATE);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = async () => {
    setIsLoading(true);
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
        date: statsDate,
        requireInstitutionScope: isThirdPartyVendor(),
      });
      setStatsData(data);
    } catch (error) {
      const message = error instanceof APIError ? error.message : "Unable to load dashboard data.";
      setStatsData(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isThirdPartyVendor() && user?.institutionCode) {
      setStatsInstitution(user.institutionCode);
      setModalInstitution(user.institutionCode);
    }
  }, [user?.institutionCode, user?.roleId]);

  useEffect(() => {
    if (isThirdPartyVendor() && !user?.institutionCode) return;
    loadDashboard();
  }, [statsInstitution, statsDate, user?.institutionCode, user?.roleId]);

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
    setModalDate(statsDate);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatsInstitution(isThirdPartyVendor() ? user?.institutionCode || "" : modalInstitution);
    setStatsDate(modalDate);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    if (!isThirdPartyVendor()) {
      setModalInstitution("all");
      setStatsInstitution("all");
    }
    setModalDate(DEFAULT_STATS_DATE);
    setModalInstitution(isThirdPartyVendor() ? user?.institutionCode || "all" : "all");
    setStatsDate(DEFAULT_STATS_DATE);
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
          <Button variant="outline" onClick={loadDashboard} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters: button opens modal */}
      <Card className="border-gray-200">
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Filter dashboard by institution and date. Current:{" "}
              <span className="font-medium text-gray-900">
                {institutionFilterLabel} • {format(statsDate, "MMM d, yyyy")}
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
            <div className="space-y-2">
              <Label htmlFor="filter-date">Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    id="filter-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {modalDate ? format(modalDate, "MMMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Calendar
                    mode="single"
                    selected={modalDate}
                    onSelect={(d) => {
                      if (d instanceof Date && !isNaN(d.getTime())) {
                        setModalDate(d);
                        setDatePickerOpen(false);
                      }
                    }}
                    defaultMonth={modalDate}
                    captionLayout="dropdown"
                    fromYear={CALENDAR_YEAR_MIN}
                    toYear={CALENDAR_YEAR_MAX}
                  />
                </PopoverContent>
              </Popover>
            </div>
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
            <p className="text-base font-medium text-gray-900">No transactions for this day</p>
            <p className="max-w-md text-sm text-gray-600">
              Nothing to show for {format(statsDate, "MMMM d, yyyy")}
              {statsInstitution !== "all" ? ` (${institutionFilterLabel})` : ""}. Pick another date or institution.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {showDashboardBody ? (
        <>
          {/* Metrics – driven by Statistics section bank/date filters */}
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
            statsDate={statsDate}
            onDateChange={setStatsDate}
            statsInstitution={isThirdPartyVendor() ? vendorLockedInstitution : statsInstitution}
            onInstitutionChange={setStatsInstitution}
            statsData={statsData}
            isLoading={isLoading}
            errorMessage={errorMessage}
            lockInstitution={isThirdPartyVendor()}
            institutionDisplayName={isThirdPartyVendor() ? user?.institutionName || user?.institutionCode : undefined}
          />
        </>
      ) : null}
    </div>
  );
}
