"use client";

import { Bar, BarChart, Cell, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

const chartHeight = 170;

export function SecondaryChartsGrid({
  lockInstitution = false,
  failedTop5Codes = [],
  transactionsByChannel = [],
  channelPie = [],
  failureByInstitution = [],
  chartColors = [],
}) {
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
        <StatisticsCard title="Failed Transactions (Top 5 Codes)" to="/dashboard/statistics/failed-codes" variant="bento">
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={failedTop5Codes.slice(0, 3)} layout="vertical" margin={{ top: 5, right: 5, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="code" width={55} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={chartColors[3] ?? "#410027"} radius={[0, 4, 4, 0]} {...CHART_ANIMATION} />
              </BarChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrap(
        "by-channel-bar",
        "md:col-span-2 lg:col-span-2",
        <StatisticsCard title="Transactions by Channel (Bar)" to="/dashboard/statistics/by-channel" variant="bento">
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
                <Bar dataKey="count" fill={chartColors[2] ?? "#FFD600"} radius={[4, 4, 0, 0]} {...CHART_ANIMATION} />
              </BarChart>
            </ResponsiveContainer>,
          )}
        </StatisticsCard>,
      )}

      {wrap(
        "channel-pie",
        undefined,
        <StatisticsCard title="Channel Mix (Pie)" to="/dashboard/statistics/by-channel" variant="bento">
          {wrapChart(
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={channelPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={58}
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
        ? wrap(
            "by-institution",
            "md:col-span-2 lg:col-span-4",
            <StatisticsCard title="Failure by destination institution" to="/dashboard/statistics/by-institution" variant="bento">
              {wrapChart(
                <ResponsiveContainer width="100%" height={220}>
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
    </DashboardStagger>
  );
}

export function ClassicChartGrid(props) {
  const {
    variant = "default",
    lockInstitution,
    successVolumes7d,
    successFailurePie,
    averageTime,
    failedTop5Codes,
    transactionsByChannel,
    channelPie,
    failureByInstitution,
    chartColors,
  } = props;

  const isAnalytics = variant === "analytics";
  const cardVariant = isAnalytics ? "analytics" : "default";
  const heroHeight = isAnalytics ? 200 : 140;
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

  const wrapChart = (content) => (isAnalytics ? <DashboardChartMotion>{content}</DashboardChartMotion> : content);

  const cards = (
    <>
      {wrapCard(
        "hero-line",
        isAnalytics ? "md:col-span-2 lg:col-span-2" : undefined,
        <StatisticsCard title="Successful Transaction Volumes" to="/dashboard/statistics/successful-transactions" variant={cardVariant}>
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
          <div className={isAnalytics ? "flex flex-col gap-3 py-2" : "flex flex-col gap-1 py-1 text-slate-700"}>
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
            <StatisticsCard title="Failure by destination institution" to="/dashboard/statistics/by-institution" variant={cardVariant}>
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
