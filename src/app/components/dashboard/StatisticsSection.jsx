"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Loader2, RefreshCcw } from "lucide-react";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { useBrand } from "../../../branding/useBrand";
import {
  buildChartCardMeta,
  buildInsightSummary,
  fetchAccountsDashboardData,
  formatDashboardRangeLabel,
  STATUS_PIE_COLORS,
} from "../../services/dashboards";
import { APIError } from "../../services/api";
import { DashboardDateRangePicker } from "./DashboardDateRangePicker";
import { ClassicChartGrid } from "./DashboardChartGrids";
import { dashboardFiltersToSearchParams } from "../../utils/dashboardFilterParams";

const DEFAULT_RANGE = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { start: d, end: d };
})();

const STATUS_LEGEND = [
  { key: "Successful", label: "Successful" },
  { key: "Pending", label: "Pending" },
  { key: "Failed", label: "Failed" },
];

export function StatisticsSection({
  statsInstitution: controlledInstitution,
  onInstitutionChange,
  statsDate: controlledDate,
  onDateChange,
  statsDateRange: controlledDateRange,
  onDateRangeChange,
  statsData,
  priorStatsData,
  isLoading: controlledLoading,
  chartsLoading: controlledChartsLoading = false,
  errorMessage: controlledError,
  lockInstitution = false,
  institutionDisplayName,
  isLiveRange = false,
  variant = "default",
  layout = "classic",
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

  const filterQuery = useMemo(() => {
    return dashboardFiltersToSearchParams({ dateRange, institution }).toString();
  }, [dateRange, institution]);

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
        chartData7d: [],
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
    chartData7d,
    successVolumes7d,
    failedTop5Codes,
    transactionsByChannel,
    failureByInstitution,
    averageTime,
    successFailurePie,
    channelPie,
    hasTransactions,
  } = stats;

  const chartCardMeta = useMemo(
    () => buildChartCardMeta(stats, dateRange, priorStatsData),
    [stats, dateRange, priorStatsData],
  );

  const insightSummary = useMemo(() => {
    if (!isAnalytics || !embedded) return "";
    return buildInsightSummary(stats);
  }, [isAnalytics, embedded, stats]);

  const priorChartData7d = priorStatsData?.chartData7d || [];

  const chartColors = brand.theme.chart;
  const isLoading = controlledLoading ?? internalLoading;
  const errorMessage = controlledError ?? internalError;
  const rangeLabel = formatDashboardRangeLabel(dateRange);

  const showCharts =
    layout !== "bento" &&
    !isLoading &&
    !controlledChartsLoading &&
    !errorMessage &&
    hasTransactions !== false &&
    (hasTransactions === true ||
      (chartData7d?.length > 0) ||
      successVolumes7d.length > 0 ||
      failedTop5Codes.length > 0 ||
      transactionsByChannel.length > 0 ||
      failureByInstitution.length > 0 ||
      successFailurePie?.length > 0 ||
      channelPie?.length > 0);

  if (layout === "bento") {
    return null;
  }

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
          {insightSummary ? (
            <p className="mt-1 text-sm font-medium text-foreground">{insightSummary}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {STATUS_LEGEND.map(({ key, label }) => (
              <span key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_PIE_COLORS[key] ?? "#94a3b8" }}
                  aria-hidden
                />
                {label}
              </span>
            ))}
          </div>
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

      {isLoading || controlledChartsLoading ? (
        <div
          className={
            isAnalytics
              ? "rounded-xl border border-[color:var(--border)] bg-card px-6 py-10 text-center text-muted-foreground"
              : "rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-slate-500"
          }
        >
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isLoading ? "Loading statistics..." : "Loading charts..."}
          </div>
        </div>
      ) : null}

      {!isLoading && !controlledChartsLoading && !errorMessage && !showCharts ? (
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
        <ClassicChartGrid
          variant={variant}
          lockInstitution={lockInstitution}
          chartData7d={chartData7d}
          priorChartData7d={priorChartData7d}
          successVolumes7d={successVolumes7d}
          successFailurePie={successFailurePie}
          averageTime={averageTime}
          failedTop5Codes={failedTop5Codes}
          transactionsByChannel={transactionsByChannel}
          channelPie={channelPie}
          failureByInstitution={failureByInstitution}
          chartColors={chartColors}
          chartCardMeta={chartCardMeta}
          filterQuery={filterQuery}
        />
      ) : null}
    </section>
  );
}
