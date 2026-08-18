import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
  AlertCircle,
  Banknote,
  CheckCircle,
  TrendingUp,
  Filter,
  Activity,
  CalendarIcon,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
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
  const navigate = useNavigate();
  const { user, isAdmin, isOperator, isThirdPartyVendor, canLogSwitchDispute } = useAuth();
  const vendorLockedInstitution = isThirdPartyVendor() ? user?.institutionCode || "all" : "all";
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
          pendingDisputes: "0",
        },
        chartData7d: [],
        responseCodes: [],
      }
    );
  }, [statsData]);
  const { metrics, chartData7d, responseCodes } = stats;
  const chartColors = brand.theme.chart;

  const openFilters = () => {
    setModalInstitution(statsInstitution);
    setModalDate(statsDate);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setStatsInstitution(isThirdPartyVendor() ? user?.institutionCode || "all" : modalInstitution);
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
          {!isThirdPartyVendor() ? (
            <Button onClick={() => navigate(brand.routes.liveMonitoring)} className="gap-2">
              <Activity className="w-4 h-4" />
              Live Monitoring
            </Button>
          ) : null}
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Transactions"
              value={metrics.totalTransactions}
              icon={ArrowLeftRight}
              iconColor="text-primary"
            />
            <MetricCard
              title="Transaction Volume"
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
            <MetricCard
              title="Pending Disputes"
              value={metrics.pendingDisputes}
              icon={AlertCircle}
              iconColor="text-[color:var(--color-chart-3)]"
              subtitle="Requires attention"
            />
          </div>

          {/* Statistics – clickable cards; filters drive metrics and charts below */}
          <StatisticsSection
            statsDate={statsDate}
            onDateChange={setStatsDate}
            statsInstitution={statsInstitution}
            onInstitutionChange={setStatsInstitution}
            statsData={statsData}
            isLoading={isLoading}
            errorMessage={errorMessage}
            lockInstitution={isThirdPartyVendor()}
            institutionDisplayName={isThirdPartyVendor() ? user?.institutionName || user?.institutionCode : undefined}
            hideLiveMonitoring={isThirdPartyVendor()}
          />

          {/* Charts – driven by Statistics section bank/date filters */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData7d}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="transactions"
                      stroke={chartColors[0]}
                      strokeWidth={2}
                      name="Transactions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume</CardTitle>
              </CardHeader>
              <CardContent className={" text-xs"}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData7d}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" fill={chartColors[2]} name="Amount (₦)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Response Codes Distribution – driven by bank/date */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Codes Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={responseCodes}
                      cx="50%"
                      cy="42%"
                      innerRadius={0}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="code"
                    >
                      {responseCodes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${value} (${props.payload.description})`,
                        props.payload.code,
                      ]}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      formatter={(value, entry) => (
                        <span className="text-sm">
                          {value}: {entry.payload.count}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Code Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {responseCodes.map((code, index) => {
                    const total = responseCodes.reduce((a, b) => a + b.count, 0);
                    return (
                      <div key={code.code} className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                          />
                          <div>
                            <p className="font-medium">{code.code}</p>
                            <p className="text-sm text-gray-600">{code.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{code.count}</p>
                          <p className="text-xs text-gray-500">
                            {total ? ((code.count / total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            <Button variant="outline" className="h-20" onClick={() => navigate("/transactions")}>
              <div className="text-center">
                <ArrowLeftRight className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm">View Transactions</p>
              </div>
            </Button>
            {(isOperator() || canLogSwitchDispute()) && (
              <Button variant="outline" className="h-20" onClick={() => navigate("/disputes/log")}>
                <div className="text-center">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Log Dispute</p>
                </div>
              </Button>
            )}
            <Button variant="outline" className="h-20" onClick={() => navigate("/wallets")}>
              <div className="text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm">{isOperator() ? "Manage Wallets" : "View Wallets"}</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
