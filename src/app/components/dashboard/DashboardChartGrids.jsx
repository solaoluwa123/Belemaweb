"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatisticsCard } from "./StatisticsCard";
import { STATUS_PIE_COLORS } from "../../services/dashboards";
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
  DonutCenterLabel,
  formatCompactCount,
  formatCountNg,
  formatNaira,
  formatNairaFull,
  truncateLabel,
} from "../../utils/dashboardChartUtils";

const chartHeight = 170;
const heroHeight = 220;

function FailedCodeTick({ x, y, payload }) {
  const row = payload?.payload;
  const label = row?.codeLabel || payload?.value || "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--muted-foreground, #64748b)" fontSize={9}>
      {label}
    </text>
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

function HeroTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const vol = payload.find((p) => p.dataKey === "transactions");
  const val = payload.find((p) => p.dataKey === "amount");
  return (
    <div
      className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-xs shadow-md"
      style={CHART_TOOLTIP_STYLE.contentStyle}
    >
      <p className="font-semibold text-foreground">{label}</p>
      {vol ? <p>Volume: {formatCountNg(vol.value)}</p> : null}
      {val ? <p>Value: {formatNairaFull(val.value)}</p> : null}
    </div>
  );
}

function prepareFailedCodes(rows) {
  return (rows || []).slice(0, 5).map((row) => ({
    ...row,
    codeLabel: row.description ? `${row.code} · ${truncateLabel(row.description, 14)}` : row.code,
  }));
}

function prepareInstitutionRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    fullName: row.name,
    name: truncateLabel(row.name, 22),
  }));
}

function computeSuccessPct(pie) {
  const total = (pie || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const success = (pie || []).find((r) => String(r.name).toLowerCase().includes("success"))?.value || 0;
  return total > 0 ? ((Number(success) / total) * 100).toFixed(1) : "0.0";
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
                <BarChart data={failedRows} layout="vertical" margin={{ top: 5, right: 5, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis type="number" hide tickFormatter={formatCompactCount} />
                  <YAxis type="category" dataKey="codeLabel" width={85} tick={<FailedCodeTick />} />
                  <Tooltip content={<FailedCodeTooltip />} />
                  <Bar dataKey="count" fill={chartColors[3] ?? "#410027"} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
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
          {transactionsByChannel.length === 0 ? (
            <ChartEmptyState message="No channel data for this period" />
          ) : (
            wrapChart(
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
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Count"]} />
                  <Bar dataKey="count" fill={chartColors[2] ?? "#FFD600"} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
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
                    <BarChart data={instRows} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={formatCompactCount} />
                      <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                      <Tooltip content={<InstitutionTooltip />} />
                      <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>
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
    successFailurePie,
    averageTime,
    failedTop5Codes,
    transactionsByChannel,
    channelPie,
    failureByInstitution,
    chartColors,
    chartCardMeta = {},
    filterQuery = "",
  } = props;

  const isAnalytics = variant === "analytics";
  const cardVariant = isAnalytics ? "analytics" : "default";
  const heroChartHeight = isAnalytics ? heroHeight : 140;
  const gridClass = isAnalytics
    ? "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";

  const failedRows = prepareFailedCodes(failedTop5Codes);
  const instRows = prepareInstitutionRows(failureByInstitution);
  const pieTotal = (successFailurePie || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
  const successPct = computeSuccessPct(successFailurePie);

  const priorMap = useMemo(
    () => new Map((priorChartData7d || []).map((r) => [r.date, Number(r.transactions) || 0])),
    [priorChartData7d],
  );

  const heroData = (chartData7d || []).map((row) => ({
    ...row,
    priorTransactions: priorMap.has(row.date) ? priorMap.get(row.date) : undefined,
  }));

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
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis
                      yAxisId="volume"
                      width={44}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatCompactCount}
                    />
                    <YAxis
                      yAxisId="value"
                      orientation="right"
                      width={52}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatNaira}
                    />
                    <Tooltip content={<HeroTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar
                      yAxisId="volume"
                      dataKey="transactions"
                      name="Volume"
                      fill={chartColors[0] ?? "#00411A"}
                      radius={[4, 4, 0, 0]}
                      {...CHART_ANIMATION}
                    />
                    <Line
                      yAxisId="value"
                      type="monotone"
                      dataKey="amount"
                      name="Value"
                      stroke={chartColors[1] ?? "#CEF445"}
                      strokeWidth={2.5}
                      dot={false}
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
          "success-fail-pie",
          undefined,
          <StatisticsCard
            title="Transaction status"
            to="/dashboard/statistics/successful-transactions"
            filterQuery={filterQuery}
            variant={cardVariant}
            subtitle={meta.status?.subtitle}
            kpi={meta.status?.kpi}
          >
            {!successFailurePie?.length ? (
              <ChartEmptyState message="No status breakdown for this period" />
            ) : (
              wrapChart(
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <PieChart>
                    <Pie
                      data={successFailurePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={58}
                      paddingAngle={2}
                      label={({ cx, cy }) => (
                        <DonutCenterLabel viewBox={{ cx, cy }} total={pieTotal} successPct={successPct} />
                      )}
                      labelLine={false}
                      {...CHART_ANIMATION}
                    >
                      {(successFailurePie || []).map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_PIE_COLORS[entry.name] ?? chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Count"]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
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
                  <BarChart data={failedRows} layout="vertical" margin={{ top: 5, right: 5, left: 90, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis type="number" hide tickFormatter={formatCompactCount} />
                    <YAxis type="category" dataKey="codeLabel" width={85} tick={<FailedCodeTick />} />
                    <Tooltip content={<FailedCodeTooltip />} />
                    <Bar dataKey="count" fill={chartColors[3] ?? "#E84A25"} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
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
                      tickFormatter={formatCompactCount}
                    />
                    <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Count"]} />
                    <Bar dataKey="count" fill={chartColors[2] ?? "#FFD600"} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
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
                  wrapChart(
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={instRows} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={formatCompactCount} />
                        <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                        <Tooltip content={<InstitutionTooltip />} />
                        <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>
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
                <LineChart data={successVolumes7d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <YAxis width={40} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={formatCompactCount} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Volume"]} />
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
            )
          )}
        </StatisticsCard>,
      )}

      {wrapCard(
        "success-fail-pie",
        undefined,
        <StatisticsCard title="Transaction Status" to="/dashboard/statistics/successful-transactions" filterQuery={filterQuery} variant={cardVariant}>
          {!successFailurePie?.length ? (
            <ChartEmptyState />
          ) : (
            wrapChart(
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={successFailurePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={52}
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
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Count"]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
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
                <BarChart data={failedRows} layout="vertical" margin={{ top: 5, right: 5, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="codeLabel" width={85} tick={<FailedCodeTick />} />
                  <Tooltip content={<FailedCodeTooltip />} />
                  <Bar dataKey="count" fill={chartColors[3]} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
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
          {transactionsByChannel.length === 0 ? (
            <ChartEmptyState />
          ) : (
            wrapChart(
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
                    tickFormatter={formatCompactCount}
                  />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [formatCountNg(v), "Count"]} />
                  <Bar dataKey="count" fill={chartColors[2]} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
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
                    <BarChart data={instRows} layout="vertical" margin={{ top: 5, right: 5, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={formatCompactCount} />
                      <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                      <Tooltip content={<InstitutionTooltip />} />
                      <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>
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
