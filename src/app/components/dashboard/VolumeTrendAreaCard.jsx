"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatisticsCard } from "./StatisticsCard";
import { CHART_ANIMATION, CHART_TOOLTIP_STYLE, DashboardChartMotion, GRID_STROKE } from "./DashboardMotion";

export function VolumeTrendAreaCard({ successVolumes7d, className }) {
  const data = successVolumes7d?.length ? successVolumes7d : [];

  return (
    <StatisticsCard
      title="Successful Transaction Volumes"
      to="/dashboard/statistics/successful-transactions"
      variant="bento"
      className={className}
    >
      <DashboardChartMotion>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#CEF445" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#CEF445" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <YAxis width={40} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#00411A"
              strokeWidth={2.5}
              fill="url(#volumeAreaFill)"
              {...CHART_ANIMATION}
            />
          </AreaChart>
        </ResponsiveContainer>
      </DashboardChartMotion>
    </StatisticsCard>
  );
}
