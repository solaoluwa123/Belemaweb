"use client";

import {
  Area,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router";
import { StatisticsCard } from "./StatisticsCard";
import {
  CHART_ANIMATION,
  CHART_TOOLTIP_STYLE,
  DashboardChartMotion,
  DashboardStagger,
  DashboardStaggerItem,
  GRID_STROKE,
} from "./DashboardMotion";
import {
  ChartEmptyState,
  alignPriorTrendByIndex,
  formatCompactCount,
  formatCountNg,
  formatNaira,
  formatNairaFull,
  prepareChannelRowsWithShare,
  prepareInstitutionTopRows,
  truncateLabel,
} from "../../utils/dashboardChartUtils";
import { appendDashboardFiltersToPath } from "../../utils/dashboardFilterParams";

const chartHeight = 170;
const heroHeight = 220;
/** Keep category bars slender — recharts otherwise fills the full band. */
const BAR_MAX = 12;

function VolumeValueGradient({ id, color }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.32} />
        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

function FailedCodeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-xs shadow-md"
      style={CHART_TOOLTIP_STYLE.contentStyle}
    >
      <p className="font-semibold text-foreground">
        {row.code} — {row.description || "Unknown"}
      </p>
      <p className="mt-1 text-foreground">{formatCountNg(row.count)} failures</p>
    </div>
  );
}

function InstitutionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-xs shadow-md"
      style={CHART_TOOLTIP_STYLE.contentStyle}
    >
      <p className="font-semibold text-foreground">{row.fullName || row.name}</p>
      {row.institutionCode ? <p className="text-muted-foreground">Code: {row.institutionCode}</p> : null}
      <p className="mt-1 text-foreground">{formatCountNg(row.count)} failures</p>
    </div>
  );
}

function HeroTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const vol = payload.find((p) => p.dataKey === "transactions" || p.dataKey === "volume");
  const val = payload.find((p) => p.dataKey === "amount");
  const prior = payload.find((p) => p.dataKey === "priorTransactions");
  const primary = val?.value != null ? formatNairaFull(val.value) : vol ? formatCountNg(vol.value) : null;
  return (
    <div className="min-w-[148px] rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      {primary ? <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{primary}</p> : null}
      <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
        {vol && val ? <p>Volume · {formatCountNg(vol.value)}</p> : null}
        {vol && !val ? <p>Volume · {formatCountNg(vol.value)}</p> : null}
        {val && vol ? <p>Value · {formatNairaFull(val.value)}</p> : null}
        {prior?.value != null ? <p className="text-slate-400">Prior · {formatCountNg(prior.value)}</p> : null}
      </div>
    </div>
  );
}

function prepareFailedCodes(rows) {
  return (rows || []).slice(0, 5).map((row) => ({
    ...row,
    codeLabel: row.description ? `${row.code} · ${truncateLabel(row.description, 14)}` : row.code,
  }));
}

function prepareInstitutionRows(rows, limit) {
  if (limit == null) {
    return (rows || []).map((row) => ({
      ...row,
      fullName: row.name,
      name: truncateLabel(row.name, 22),
    }));
  }
  return prepareInstitutionTopRows(rows, limit);
}

export function SecondaryChartsGrid({
  lockInstitution = false,
  failedTop5Codes = [],
  transactionsByChannel = [],
  channelPie = [],
  failureByInstitution = [],
  chartColors = [],
  filterQuery = "",
}) {
  const failedRows = prepareFailedCodes(failedTop5Codes);
  const instRows = prepareInstitutionRows(failureByInstitution);
  const channelRows = prepareChannelRowsWithShare(transactionsByChannel);

  const wrap = (key, className, card) => (
    <DashboardStaggerItem key={key} className={className}>
      {card}
    </DashboardStaggerItem>
  );

  const wrapChart = (content) => <DashboardChartMotion>{content}</DashboardChartMotion>;

  return (
    <DashboardStagger className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {wrap(
        "failed-codes",
        undefined,
        <StatisticsCard
          title="Failed Transactions (Top 5 Codes)"
          to="/dashboard/statistics/failed-codes"
          filterQuery={filterQuery}
          variant="bento"
        >
          {failedRows.length === 0 ? (
            <ChartEmptyState message="No failures in this period" />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={failedRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    width={42}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip content={<FailedCodeTooltip />} />
                  <Bar dataKey="count" fill={chartColors[3] ?? "#410027"} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION} />
                </BarChart>
              </ResponsiveContainer>,
            )
          )}
        </StatisticsCard>,
      )}

      {wrap(
        "by-channel-bar",
        "md:col-span-2 lg:col-span-2",
        <StatisticsCard
          title="Channel distribution"
          to="/dashboard/statistics/by-channel"
          filterQuery={filterQuery}
          variant="bento"
        >
          {channelRows.length === 0 ? (
            <ChartEmptyState message="No channel data for this period" />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={channelRows} margin={{ top: 16, right: 5, left: 0, bottom: 0 }}>
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
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(v, _n, item) => [
                      `${formatCountNg(v)} (${item?.payload?.shareLabel ?? ""})`,
                      "Count",
                    ]}
                  />
                  <Bar dataKey="count" fill={chartColors[2] ?? "#FFD600"} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                    <LabelList dataKey="shareLabel" position="top" style={{ fontSize: 9, fill: "var(--muted-foreground, #64748b)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )
          )}
        </StatisticsCard>,
      )}

      {!lockInstitution
        ? wrap(
            "by-institution",
            "md:col-span-2 lg:col-span-4",
            <StatisticsCard
              title="Failure by destination institution"
              to="/dashboard/statistics/by-institution"
              filterQuery={filterQuery}
              variant="bento"
            >
              {instRows.length === 0 ? (
                <ChartEmptyState message="No institution failures in this period" />
              ) : (
                wrapChart(
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={instRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        width={42}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickFormatter={formatCompactCount}
                      />
                      <Tooltip content={<InstitutionTooltip />} />
                      <Bar dataKey="count" name="Failures" radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                        {instRows.map((entry) => (
                          <Cell key={entry.name || entry.institutionCode} fill={entry.fill || chartColors[0]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>,
                )
              )}
            </StatisticsCard>,
          )
        : null}
    </DashboardStagger>
  );
}

export function ClassicChartGrid(props) {
  const {
    variant = "default",
    lockInstitution,
    chartData7d = [],
    priorChartData7d = [],
    successVolumes7d,
    averageTime,
    failedTop5Codes,
    transactionsByChannel,
    failureByInstitution,
    chartColors,
    chartCardMeta = {},
    filterQuery = "",
    ftTargetSeconds = 3,
    dateRange,
    institutionFilter = "all",
  } = props;

  const isAnalytics = variant === "analytics";
  const cardVariant = isAnalytics ? "analytics" : "default";
  const heroChartHeight = isAnalytics ? heroHeight : 140;
  const gridClass = isAnalytics
    ? "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";

  const failedRows = prepareFailedCodes(failedTop5Codes);
  const instRowsAll = prepareInstitutionRows(failureByInstitution, 10);
  const instRows = instRowsAll;
  const instTotalCount = (failureByInstitution || []).length;
  const channelRows = prepareChannelRowsWithShare(transactionsByChannel);
  const institutionViewAllPath = appendDashboardFiltersToPath("/dashboard/statistics/by-institution", {
    dateRange,
    institution: institutionFilter,
  });

  const heroData = alignPriorTrendByIndex(chartData7d, priorChartData7d);

  const wrapCard = (key, className, card) => {
    if (!isAnalytics) return card;
    return (
      <DashboardStaggerItem key={key} className={className}>
        {card}
      </DashboardStaggerItem>
    );
  };

  const wrapChart = (content) => (isAnalytics ? <DashboardChartMotion>{content}</DashboardChartMotion> : content);

  const meta = chartCardMeta;

  if (isAnalytics) {
    const analyticsCards = (
      <>
        {wrapCard(
          "hero-volume-value",
          "lg:col-span-3",
          <StatisticsCard
            title="Transaction volume & value"
            to="/dashboard/statistics/successful-transactions"
            filterQuery={filterQuery}
            variant={cardVariant}
            subtitle={meta.hero?.subtitle}
            kpi={meta.hero?.kpi}
          >
            {heroData.length === 0 ? (
              <ChartEmptyState message="No transaction trend data for this period" />
            ) : (
              wrapChart(
                <ResponsiveContainer width="100%" height={heroChartHeight}>
                  <ComposedChart data={heroData} margin={{ top: 8, right: 48, left: 0, bottom: 0 }}>
                    <VolumeValueGradient id="heroVolumeFill" color={chartColors[0] ?? "#00411A"} />
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="volume"
                      width={44}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatCompactCount}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="value"
                      orientation="right"
                      width={52}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatNaira}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<HeroTooltip />}
                      cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area
                      yAxisId="volume"
                      type="monotone"
                      dataKey="transactions"
                      name="Volume"
                      stroke={chartColors[0] ?? "#00411A"}
                      strokeWidth={2.25}
                      fill="url(#heroVolumeFill)"
                      fillOpacity={1}
                      baseValue={0}
                      dot={false}
                      activeDot={{
                        r: 5,
                        stroke: "#fff",
                        strokeWidth: 2,
                        fill: chartColors[0] ?? "#00411A",
                      }}
                      {...CHART_ANIMATION}
                    />
                    <Line
                      yAxisId="value"
                      type="monotone"
                      dataKey="amount"
                      name="Value"
                      stroke={chartColors[1] ?? "#CEF445"}
                      strokeWidth={2.25}
                      dot={false}
                      activeDot={{
                        r: 5,
                        stroke: "#fff",
                        strokeWidth: 2,
                        fill: chartColors[1] ?? "#CEF445",
                      }}
                      {...CHART_ANIMATION}
                    />
                    {priorChartData7d?.length > 0 ? (
                      <Line
                        yAxisId="volume"
                        type="monotone"
                        dataKey="priorTransactions"
                        name="Prior volume"
                        stroke="var(--muted-foreground, #94a3b8)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        connectNulls
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>,
              )
            )}
          </StatisticsCard>,
        )}

        {wrapCard(
          "avg-time",
          undefined,
          <StatisticsCard
            title="Average time"
            to="/dashboard/statistics/average-time"
            filterQuery={filterQuery}
            variant={cardVariant}
            subtitle={meta.avgTime?.subtitle}
            kpi={meta.avgTime?.kpi}
          >
            <div className="flex flex-col gap-3 py-2">
              <div className="rounded-lg bg-[#f5eef2] px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#410027]/70">NE</p>
                <p className="text-lg font-bold text-[#410027]">{averageTime?.ne ?? 0} secs</p>
              </div>
              <div className="rounded-lg bg-[#eef8c8] px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#00411A]/70">FT</p>
                <p className="text-lg font-bold text-[#00411A]">{Number(averageTime?.ft || 0).toFixed(1)} secs</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dce8c8]">
                  <div
                    className="h-full rounded-full bg-[#00411A] transition-all"
                    style={{
                      width: `${Math.min(100, (Number(averageTime?.ft || 0) / ftTargetSeconds) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Target {ftTargetSeconds}s ·{" "}
                  {Number(averageTime?.ft || 0) <= ftTargetSeconds ? "Within SLA" : "Above SLA"}
                </p>
              </div>
            </div>
          </StatisticsCard>,
        )}

        {wrapCard(
          "failed-codes",
          undefined,
          <StatisticsCard
            title="Failed transactions (top 5 codes)"
            to="/dashboard/statistics/failed-codes"
            filterQuery={filterQuery}
            variant={cardVariant}
            subtitle={meta.failedCodes?.subtitle}
            kpi={meta.failedCodes?.kpi}
          >
            {failedRows.length === 0 ? (
              <ChartEmptyState message="No failures in this period" />
            ) : (
              wrapChart(
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={failedRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis
                      dataKey="code"
                      tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis
                      width={42}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatCompactCount}
                    />
                    <Tooltip content={<FailedCodeTooltip />} />
                    <Bar dataKey="count" fill={chartColors[3] ?? "#E84A25"} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION} />
                  </BarChart>
                </ResponsiveContainer>,
              )
            )}
          </StatisticsCard>,
        )}

        {wrapCard(
          "by-channel",
          undefined,
          <StatisticsCard
            title="Channel distribution"
            to="/dashboard/statistics/by-channel"
            filterQuery={filterQuery}
            variant={cardVariant}
            subtitle={meta.channels?.subtitle}
            kpi={meta.channels?.kpi}
          >
            {transactionsByChannel.length === 0 ? (
              <ChartEmptyState message="No channel data for this period" />
            ) : (
              wrapChart(
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={channelRows} margin={{ top: 16, right: 5, left: 0, bottom: 0 }}>
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
                      tickFormatter={formatCompactCount}
                    />
                    <Tooltip
                      {...CHART_TOOLTIP_STYLE}
                      formatter={(v, _n, item) => [
                        `${formatCountNg(v)} (${item?.payload?.shareLabel ?? ""})`,
                        "Count",
                      ]}
                    />
                    <Bar dataKey="count" fill={chartColors[2] ?? "#FFD600"} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                      <LabelList dataKey="shareLabel" position="top" style={{ fontSize: 9, fill: "var(--muted-foreground, #64748b)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>,
              )
            )}
          </StatisticsCard>,
        )}

        {!lockInstitution
          ? wrapCard(
              "by-institution",
              "md:col-span-2 lg:col-span-3",
              <StatisticsCard
                title="Failure by destination institution"
                to="/dashboard/statistics/by-institution"
                filterQuery={filterQuery}
                variant={cardVariant}
                subtitle={meta.institutions?.subtitle}
                kpi={meta.institutions?.kpi}
              >
                {instRows.length === 0 ? (
                  <ChartEmptyState message="No institution failures in this period" />
                ) : (
                  <div className="space-y-2">
                    {wrapChart(
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={instRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={70}
                          />
                          <YAxis
                            width={42}
                            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                            tickFormatter={formatCompactCount}
                          />
                          <Tooltip content={<InstitutionTooltip />} />
                          <Bar dataKey="count" name="Failures" radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                            {instRows.map((entry) => (
                              <Cell key={entry.name || entry.institutionCode} fill={entry.fill || chartColors[0]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>,
                    )}
                    {instTotalCount > 10 ? (
                      <Link
                        to={institutionViewAllPath}
                        className="inline-flex text-xs font-medium text-[#00411A] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View all {instTotalCount} institutions →
                      </Link>
                    ) : null}
                  </div>
                )}
              </StatisticsCard>,
            )
          : null}
      </>
    );

    return <DashboardStagger className={gridClass}>{analyticsCards}</DashboardStagger>;
  }

  const cards = (
    <>
      {wrapCard(
        "hero-line",
        undefined,
        <StatisticsCard
          title="Successful Transaction Volumes"
          to="/dashboard/statistics/successful-transactions"
          filterQuery={filterQuery}
          variant={cardVariant}
          subtitle={meta.successLine?.subtitle}
          kpi={meta.successLine?.kpi}
        >
          {successVolumes7d.length === 0 ? (
            <ChartEmptyState />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={heroChartHeight}>
                <ComposedChart data={successVolumes7d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <VolumeValueGradient id="classicVolumeFill" color={chartColors[0]} />
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={40}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={formatCompactCount}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<HeroTooltip />}
                    cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    name="Volume"
                    stroke={chartColors[0]}
                    strokeWidth={2.25}
                    fill="url(#classicVolumeFill)"
                    fillOpacity={1}
                    baseValue={0}
                    dot={false}
                    activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: chartColors[0] }}
                    {...CHART_ANIMATION}
                  />
                </ComposedChart>
              </ResponsiveContainer>,
            )
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "avg-time",
        undefined,
        <StatisticsCard title="Average Time" to="/dashboard/statistics/average-time" filterQuery={filterQuery} variant={cardVariant}>
          <div className="flex flex-col gap-1 py-1 text-slate-700">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#410027]/70">NE</p>
              <p className="text-sm font-medium">{averageTime?.ne ?? 0} secs</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#00411A]/70">FT</p>
              <p className="text-sm font-medium">{Number(averageTime?.ft || 0).toFixed(2)} secs</p>
            </div>
          </div>
        </StatisticsCard>,
      )}

      {wrapCard(
        "failed-codes",
        undefined,
        <StatisticsCard title="Failed Transactions (Top 5 Codes)" to="/dashboard/statistics/failed-codes" filterQuery={filterQuery} variant={cardVariant}>
          {failedRows.length === 0 ? (
            <ChartEmptyState />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={failedRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    width={42}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip content={<FailedCodeTooltip />} />
                  <Bar dataKey="count" fill={chartColors[3]} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION} />
                </BarChart>
              </ResponsiveContainer>,
            )
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "by-channel-bar",
        undefined,
        <StatisticsCard title="Transactions by Channel" to="/dashboard/statistics/by-channel" filterQuery={filterQuery} variant={cardVariant}>
          {channelRows.length === 0 ? (
            <ChartEmptyState />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={channelRows} margin={{ top: 16, right: 5, left: 0, bottom: 0 }}>
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
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(v, _n, item) => [
                      `${formatCountNg(v)} (${item?.payload?.shareLabel ?? ""})`,
                      "Count",
                    ]}
                  />
                  <Bar dataKey="count" fill={chartColors[2]} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                    <LabelList dataKey="shareLabel" position="top" style={{ fontSize: 9, fill: "var(--muted-foreground, #64748b)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )
          )}
        </StatisticsCard>,
      )}

      {!lockInstitution
        ? wrapCard(
            "by-institution",
            "sm:col-span-2 lg:col-span-4",
            <StatisticsCard title="Failure by destination institution" to="/dashboard/statistics/by-institution" filterQuery={filterQuery} variant={cardVariant}>
              {instRows.length === 0 ? (
                <ChartEmptyState />
              ) : (
                wrapChart(
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={instRows} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        width={42}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickFormatter={formatCompactCount}
                      />
                      <Tooltip content={<InstitutionTooltip />} />
                      <Bar dataKey="count" name="Failures" radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} {...CHART_ANIMATION}>
                        {instRows.map((entry) => (
                          <Cell key={entry.name || entry.institutionCode} fill={entry.fill || chartColors[0]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>,
                )
              )}
            </StatisticsCard>,
          )
        : null}
    </>
  );

  return <div className={gridClass}>{cards}</div>;
}
