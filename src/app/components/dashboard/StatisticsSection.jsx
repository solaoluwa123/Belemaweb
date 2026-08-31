"use client";

import { useEffect, useMemo, useState } from "react";
import { StatisticsCard } from "./StatisticsCard";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Loader2, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { useBrand } from "../../../branding/useBrand";
import { fetchAccountsDashboardData, formatDashboardRangeLabel, STATUS_PIE_COLORS } from "../../services/dashboards";
import { APIError } from "../../services/api";
import { DashboardDateRangePicker } from "./DashboardDateRangePicker";
import {
  CHART_ANIMATION,
  CHART_TOOLTIP_STYLE,
  DashboardChartMotion,
  DashboardStagger,
  DashboardStaggerItem,
  GRID_STROKE,
} from "./DashboardMotion";

const DEFAULT_RANGE = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { start: d, end: d };
})();

function ChartGrid({
  variant,
  lockInstitution,
  successVolumes7d,
  successFailurePie,
  averageTime,
  failedTop5Codes,
  transactionsByChannel,
  channelPie,
  failureByInstitution,
  chartColors,
}) {
  const isAnalytics = variant === "analytics";
  const cardVariant = isAnalytics ? "analytics" : "default";
  const heroHeight = isAnalytics ? 200 : 140;
  const chartHeight = isAnalytics ? 170 : 140;
  const gridClass = isAnalytics
    ? "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4"
    : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";

  const wrapCard = (key, className, card) => {
    if (!isAnalytics) return card;
    return (
      <DashboardStaggerItem key={key} className={className}>
        {card}
      </DashboardStaggerItem>
    );
  };

  const wrapChart = (content) => {
    if (!isAnalytics) return content;
    return <DashboardChartMotion>{content}</DashboardChartMotion>;
  };

  const cards = (
    <>
      {wrapCard(
        "hero-line",
        isAnalytics ? "md:col-span-2 lg:col-span-2" : undefined,
        <StatisticsCard
          title="Successful Transaction Volumes"
          to="/dashboard/statistics/successful-transactions"
          variant={cardVariant}
        >
          {wrapChart(
            <ResponsiveContainer width="100%" height={heroHeight}>
              <LineChart data={successVolumes7d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis width={40} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke={chartColors[0]}
                  strokeWidth={2.5}
                  dot={false}
                  {...CHART_ANIMATION}
                />
              </LineChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "success-fail-pie",
        undefined,
        <StatisticsCard title="Transaction Status" to="/dashboard/statistics/successful-transactions" variant={cardVariant}>
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={successFailurePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={isAnalytics ? 32 : 28}
                  outerRadius={isAnalytics ? 58 : 52}
                  paddingAngle={2}
                  {...CHART_ANIMATION}
                >
                  {(successFailurePie || []).map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_PIE_COLORS[entry.name] ?? chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [Number(v).toLocaleString(), "Count"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "avg-time",
        undefined,
        <StatisticsCard title="Average Time" to="/dashboard/statistics/average-time" variant={cardVariant}>
          <div
            className={
              isAnalytics
                ? "flex flex-col gap-3 py-2"
                : "flex flex-col gap-1 py-1 text-slate-700"
            }
          >
            <div className={isAnalytics ? "rounded-lg bg-[#f5eef2] px-3 py-2" : undefined}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#410027]/70">NE</p>
              <p className={isAnalytics ? "text-lg font-bold text-[#410027]" : "text-sm font-medium"}>
                {averageTime?.ne ?? 0} secs
              </p>
            </div>
            <div className={isAnalytics ? "rounded-lg bg-[#eef8c8] px-3 py-2" : undefined}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#00411A]/70">FT</p>
              <p className={isAnalytics ? "text-lg font-bold text-[#00411A]" : "text-sm font-medium"}>
                {Number(averageTime?.ft || 0).toFixed(2)} secs
              </p>
            </div>
          </div>
        </StatisticsCard>,
      )}

      {wrapCard(
        "failed-codes",
        undefined,
        <StatisticsCard title="Failed Transactions (Top 5 Codes)" to="/dashboard/statistics/failed-codes" variant={cardVariant}>
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={failedTop5Codes.slice(0, 3)} layout="vertical" margin={{ top: 5, right: 5, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="code" width={55} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={chartColors[3]} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
              </BarChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "by-channel-bar",
        isAnalytics ? "md:col-span-2 lg:col-span-2" : undefined,
        <StatisticsCard title="Transactions by Channel (Bar)" to="/dashboard/statistics/by-channel" variant={cardVariant}>
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={transactionsByChannel} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="channel"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={45}
                />
                <YAxis
                  width={42}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [v.toLocaleString(), "Count"]} />
                <Bar dataKey="count" fill={chartColors[2]} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
              </BarChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "channel-pie",
        undefined,
        <StatisticsCard title="Channel Mix (Pie)" to="/dashboard/statistics/by-channel" variant={cardVariant}>
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={channelPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={isAnalytics ? 58 : 52}
                  paddingAngle={1}
                  {...CHART_ANIMATION}
                >
                  {(channelPie || []).map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[(index + 1) % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [Number(v).toLocaleString(), "Count"]} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {!lockInstitution
        ? wrapCard(
            "by-institution",
            isAnalytics ? "md:col-span-2 lg:col-span-4" : "sm:col-span-2 lg:col-span-4",
            <StatisticsCard
              title="Failure by destination institution"
              to="/dashboard/statistics/by-institution"
              variant={cardVariant}
            >
              {wrapChart(
                <ResponsiveContainer width="100%" height={isAnalytics ? 220 : 200}>
                  <BarChart data={failureByInstitution} layout="vertical" margin={{ top: 5, right: 5, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                    <Tooltip {...CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>
                      {failureByInstitution.map((entry) => (
                        <Cell key={entry.name || entry.institutionCode} fill={entry.fill || chartColors[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>,
              )}
            </StatisticsCard>,
          )
        : null}
    </>
  );

  if (isAnalytics) {
    return <DashboardStagger className={gridClass}>{cards}</DashboardStagger>;
  }

  return <div className={gridClass}>{cards}</div>;
}

export function StatisticsSection({
  statsInstitution: controlledInstitution,
  onInstitutionChange,
  statsDate: controlledDate,
  onDateChange,
  statsDateRange: controlledDateRange,
  onDateRangeChange,
  statsData,
  isLoading: controlledLoading,
  errorMessage: controlledError,
  lockInstitution = false,
  institutionDisplayName,
  isLiveRange = false,
  variant = "default",
}) {
  const { brand } = useBrand();
  const [internalInstitution, setInternalInstitution] = useState("all");
  const [internalDateRange, setInternalDateRange] = useState(DEFAULT_RANGE);

  const institution = controlledInstitution !== undefined ? controlledInstitution : internalInstitution;
  const setInstitution = onInstitutionChange ?? setInternalInstitution;

  const dateRange = useMemo(() => {
    if (controlledDateRange) return controlledDateRange;
    if (controlledDate) return { start: controlledDate, end: controlledDate };
    return internalDateRange;
  }, [controlledDateRange, controlledDate, internalDateRange]);

  const setDateRange = (next) => {
    if (onDateRangeChange) {
      onDateRangeChange(next);
      return;
    }
    if (onDateChange) {
      onDateChange(next.start);
      return;
    }
    setInternalDateRange(next);
  };

  const [internalStats, setInternalStats] = useState(null);
  const [internalLoading, setInternalLoading] = useState(controlledLoading ?? true);
  const [internalError, setInternalError] = useState("");

  const embedded = Boolean(statsData);
  const isAnalytics = variant === "analytics";

  const loadStatistics = async () => {
    if (statsData) return;

    setInternalLoading(true);
    setInternalError("");
    try {
      if (lockInstitution && (!institution || institution === "all")) {
        setInternalStats(null);
        setInternalError("Your account is not linked to an institution.");
        return;
      }
      const data = await fetchAccountsDashboardData({
        institutionCode: institution !== "all" ? institution : null,
        dateRange,
        requireInstitutionScope: lockInstitution,
      });
      setInternalStats(data);
    } catch (error) {
      const message = error instanceof APIError ? error.message : "Unable to load dashboard statistics.";
      setInternalStats(null);
      setInternalError(message);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (statsData) return;
    loadStatistics();
  }, [statsData, institution, dateRange]);

  const stats = useMemo(() => {
    return (
      statsData ??
      internalStats ?? {
        successVolumes7d: [],
        failedTop5Codes: [],
        transactionsByChannel: [],
        failureByInstitution: [],
        averageTime: { ne: 0, ft: 0 },
        successFailurePie: [],
        channelPie: [],
      }
    );
  }, [statsData, internalStats]);

  const {
    successVolumes7d,
    failedTop5Codes,
    transactionsByChannel,
    failureByInstitution,
    averageTime,
    successFailurePie,
    channelPie,
    hasTransactions,
  } = stats;

  const chartColors = brand.theme.chart;
  const isLoading = controlledLoading ?? internalLoading;
  const errorMessage = controlledError ?? internalError;
  const rangeLabel = formatDashboardRangeLabel(dateRange);

  const showCharts =
    !isLoading &&
    !errorMessage &&
    hasTransactions !== false &&
    (hasTransactions === true ||
      successVolumes7d.length > 0 ||
      failedTop5Codes.length > 0 ||
      transactionsByChannel.length > 0 ||
      failureByInstitution.length > 0 ||
      successFailurePie?.length > 0 ||
      channelPie?.length > 0);

  return (
    <section className="space-y-6" aria-labelledby="statistics-heading">
      {!isAnalytics || !embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="statistics-heading" className="text-2xl font-bold text-slate-900">
              Statistics
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {rangeLabel}
              {isLiveRange ? " · updating live" : ""}
            </p>
          </div>
          {!embedded ? (
            <Button variant="outline" onClick={loadStatistics} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
          ) : null}
        </div>
      ) : (
        <div>
          <h2 id="statistics-heading" className="text-lg font-semibold text-foreground">
            Transaction insights
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rangeLabel}
            {isLiveRange ? " · updating live" : ""}
          </p>
        </div>
      )}

      {!embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          {lockInstitution ? (
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Source financial institution</Label>
              <p className="text-sm font-medium text-slate-900">{institutionDisplayName || institution}</p>
            </div>
          ) : (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="stat-institution" className="text-sm font-medium text-slate-700">
                Source Financial Institutions*
              </Label>
              <Select value={institution} onValueChange={setInstitution}>
                <SelectTrigger id="stat-institution" className="w-full min-w-0 sm:w-[180px]">
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
          )}
          <DashboardDateRangePicker
            id="stat-date-range"
            label="Date range"
            value={dateRange}
            onChange={setDateRange}
            className="min-w-0 sm:min-w-[240px]"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div
          className={
            isAnalytics
              ? "rounded-xl border border-[color:var(--border)] bg-card px-6 py-10 text-center text-muted-foreground"
              : "rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-slate-500"
          }
        >
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading statistics...
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && !showCharts ? (
        <div
          className={
            isAnalytics
              ? "rounded-xl border border-[color:var(--border)] bg-card px-6 py-10 text-center text-sm text-muted-foreground"
              : "rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600"
          }
        >
          No transactions for {rangeLabel}.
        </div>
      ) : null}

      {showCharts ? (
        <ChartGrid
          variant={variant}
          lockInstitution={lockInstitution}
          successVolumes7d={successVolumes7d}
          successFailurePie={successFailurePie}
          averageTime={averageTime}
          failedTop5Codes={failedTop5Codes}
          transactionsByChannel={transactionsByChannel}
          channelPie={channelPie}
          failureByInstitution={failureByInstitution}
          chartColors={chartColors}
        />
      ) : null}
    </section>
  );
}
