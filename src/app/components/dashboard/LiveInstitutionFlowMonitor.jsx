"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Loader2, Radio, RefreshCcw } from "lucide-react";
import { MetricCard } from "../shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { LiveTransactionFeed } from "./LiveTransactionFeed";
import { DashboardStagger, DashboardStaggerItem } from "./DashboardMotion";
import { APIError } from "../../services/api";
import {
  fetchLiveInstitutionMonitoring,
  LIVE_MONITORING_POLL_MS,
  LIVE_MONITORING_WINDOW_MINUTES,
} from "../../services/dashboards";
import { TRANSGATE_BANK_OPTIONS } from "../../data/mockData";
import { cn } from "../ui/utils";

const FLOW_COLORS = {
  inSuccess: "#00411A",
  inFail: "#E84A25",
  outSuccess: "#7CB518",
  outFail: "#F97316",
  inflowLine: "#00411A",
  outflowLine: "#CEF445",
};

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function FlowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      <div className="space-y-1 text-muted-foreground">
        <p>
          Inflow {formatCount(row.inflowTotal)} · {formatPct(row.inflowSuccess)} success
        </p>
        <p>
          Outflow {formatCount(row.outflowTotal)} · {formatPct(row.outflowSuccess)} success
        </p>
      </div>
    </div>
  );
}

function RateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="text-muted-foreground">
          {entry.name}: {Number(entry.value || 0).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

/**
 * Institution inflow/outflow health monitor with KPI strip, paired stacked bars,
 * selected-FI success-rate time series, and a collapsible live feed.
 */
export function LiveInstitutionFlowMonitor({
  institutionCode: institutionCodeProp = null,
  showInstitutionFilter = true,
}) {
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [institutions, setInstitutions] = useState([]);
  const [meta, setMeta] = useState({
    windowMinutes: LIVE_MONITORING_WINDOW_MINUTES,
    bucketMinutes: 10,
  });
  const [selectedCode, setSelectedCode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const loadSeq = useRef(0);

  const effectiveInstitution = useMemo(() => {
    if (institutionCodeProp) return institutionCodeProp;
    if (institutionFilter !== "all") return institutionFilter;
    return null;
  }, [institutionCodeProp, institutionFilter]);

  const loadMonitoring = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++loadSeq.current;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage("");
      try {
        const result = await fetchLiveInstitutionMonitoring({
          institutionCode: effectiveInstitution,
          limit: effectiveInstitution ? 1 : 8,
        });
        if (seq !== loadSeq.current) return;
        setInstitutions(result.institutions);
        setMeta(result.meta);
        setLastUpdatedAt(new Date());
        setSelectedCode((prev) => {
          if (prev && result.institutions.some((row) => row.institutionCode === prev)) return prev;
          return result.institutions[0]?.institutionCode ?? null;
        });
      } catch (error) {
        if (seq !== loadSeq.current) return;
        const message =
          error instanceof APIError ? error.message : "Unable to load live monitoring.";
        setErrorMessage(message);
        if (!silent) setInstitutions([]);
      } finally {
        if (seq !== loadSeq.current) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [effectiveInstitution],
  );

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadMonitoring({ silent: true });
    }, LIVE_MONITORING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadMonitoring]);

  const chartRows = useMemo(
    () =>
      institutions.map((row) => ({
        ...row,
        label: row.shortName || row.name || row.institutionCode,
        inSuccessCount: row.inflowSuccessCount,
        inFailCount: row.inflowFailCount,
        outSuccessCount: row.outflowSuccessCount,
        outFailCount: row.outflowFailCount,
      })),
    [institutions],
  );

  const selected = useMemo(
    () => institutions.find((row) => row.institutionCode === selectedCode) ?? null,
    [institutions, selectedCode],
  );

  const kpis = useMemo(() => {
    let inflowTotal = 0;
    let inflowSuccess = 0;
    let outflowTotal = 0;
    let outflowSuccess = 0;
    for (const row of institutions) {
      inflowTotal += Number(row.inflowTotal) || 0;
      inflowSuccess += Number(row.inflowSuccessCount) || 0;
      outflowTotal += Number(row.outflowTotal) || 0;
      outflowSuccess += Number(row.outflowSuccessCount) || 0;
    }
    return {
      inflowTotal,
      outflowTotal,
      inflowSuccessPct: inflowTotal > 0 ? Math.round((inflowSuccess * 100) / inflowTotal) : 0,
      outflowSuccessPct: outflowTotal > 0 ? Math.round((outflowSuccess * 100) / outflowTotal) : 0,
    };
  }, [institutions]);

  const seriesRows = selected?.timeSeries ?? [];
  const barHeight = Math.max(280, chartRows.length * 44 + 48);
  const windowLabel = `${meta.windowMinutes || LIVE_MONITORING_WINDOW_MINUTES} min`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Live Monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Institution inflow and outflow volumes with success vs failure over the last {windowLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showInstitutionFilter ? (
            <div className="min-w-[200px] space-y-1.5">
              <Label htmlFor="live-flow-institution" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Institution
              </Label>
              <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                <SelectTrigger id="live-flow-institution" className="bg-card">
                  <SelectValue placeholder="All institutions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All institutions</SelectItem>
                  {TRANSGATE_BANK_OPTIONS.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button
            variant="outline"
            onClick={() => loadMonitoring()}
            disabled={isLoading || isRefreshing}
            className="gap-2 bg-card"
          >
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-[#CEF445]" />
            Auto-refresh
            {lastUpdatedAt
              ? ` · ${lastUpdatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : ""}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading institution flows…
        </div>
      ) : null}

      {!isLoading && !errorMessage && institutions.length === 0 ? (
        <Card className="border-[color:var(--border)] bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ArrowLeftRight className="h-10 w-10 text-[#CEF445]" />
            <p className="text-base font-medium text-foreground">No institution flow in this window</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Nothing to show for the last {windowLabel}. Pick another institution or wait for live traffic.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && institutions.length > 0 ? (
        <>
          <DashboardStagger className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStaggerItem className="h-full">
              <MetricCard
                title="Inflow volume"
                value={formatCount(kpis.inflowTotal)}
                icon={ArrowDownLeft}
                iconAccent="lime"
                size="compact"
                subtitle={effectiveInstitution ? "Filtered institution" : "Top institutions"}
              />
            </DashboardStaggerItem>
            <DashboardStaggerItem className="h-full">
              <MetricCard
                title="Inflow success"
                value={formatPct(kpis.inflowSuccessPct)}
                icon={ArrowDownLeft}
                iconAccent="lime"
                size="compact"
                gauge={kpis.inflowSuccessPct}
              />
            </DashboardStaggerItem>
            <DashboardStaggerItem className="h-full">
              <MetricCard
                title="Outflow volume"
                value={formatCount(kpis.outflowTotal)}
                icon={ArrowUpRight}
                iconAccent="yellow"
                size="compact"
                subtitle={effectiveInstitution ? "Filtered institution" : "Top institutions"}
              />
            </DashboardStaggerItem>
            <DashboardStaggerItem className="h-full">
              <MetricCard
                title="Outflow success"
                value={formatPct(kpis.outflowSuccessPct)}
                icon={ArrowUpRight}
                iconAccent="yellow"
                size="compact"
                gauge={kpis.outflowSuccessPct}
              />
            </DashboardStaggerItem>
          </DashboardStagger>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Card className="border-[color:var(--border)] bg-card shadow-sm xl:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Inflow / outflow by institution</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Paired stacks: inflow (dark green / orange) and outflow (lime / amber). Click a bar to focus the trend.
                </p>
              </CardHeader>
              <CardContent>
                <div style={{ height: barHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={chartRows}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                      barCategoryGap="18%"
                      barGap={4}
                      onClick={(state) => {
                        const code = state?.activePayload?.[0]?.payload?.institutionCode;
                        if (code) setSelectedCode(code);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip content={<FlowTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="inSuccessCount"
                        name="In success"
                        stackId="in"
                        fill={FLOW_COLORS.inSuccess}
                        cursor="pointer"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="inFailCount"
                        name="In fail"
                        stackId="in"
                        fill={FLOW_COLORS.inFail}
                        cursor="pointer"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="outSuccessCount"
                        name="Out success"
                        stackId="out"
                        fill={FLOW_COLORS.outSuccess}
                        cursor="pointer"
                      />
                      <Bar
                        dataKey="outFailCount"
                        name="Out fail"
                        stackId="out"
                        fill={FLOW_COLORS.outFail}
                        cursor="pointer"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[color:var(--border)] bg-card shadow-sm xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Success rate over time
                  {selected ? (
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {selected.shortName || selected.name}
                    </span>
                  ) : null}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Inflow vs outflow success % by {meta.bucketMinutes || 10}-minute bucket.
                </p>
              </CardHeader>
              <CardContent>
                {seriesRows.length ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={seriesRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={40} />
                        <Tooltip content={<RateTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="inflow"
                          name="Inflow success %"
                          stroke={FLOW_COLORS.inflowLine}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="outflow"
                          name="Outflow success %"
                          stroke={FLOW_COLORS.outflowLine}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No time buckets for this institution yet.
                  </div>
                )}

                {institutions.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {institutions.map((row) => {
                      const active = row.institutionCode === selectedCode;
                      return (
                        <button
                          key={row.institutionCode}
                          type="button"
                          onClick={() => setSelectedCode(row.institutionCode)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-[#00411A] bg-[#eef8c8] text-[#00411A]"
                              : "border-[color:var(--border)] bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {row.shortName || row.name || row.institutionCode}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Collapsible open={feedOpen} onOpenChange={setFeedOpen}>
        <Card className="border-[color:var(--border)] bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <p className="text-xs text-muted-foreground">Live transaction feed for drill-down</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card">
                {feedOpen ? "Hide feed" : "Show feed"}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {feedOpen ? (
                <LiveTransactionFeed
                  institutionCode={effectiveInstitution || selectedCode}
                  showInstitutionFilter={false}
                  compact
                />
              ) : null}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
