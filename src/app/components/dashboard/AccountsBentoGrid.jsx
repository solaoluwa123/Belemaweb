"use client";

import { useMemo } from "react";
import { ArrowLeftRight, Banknote, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useBrand } from "../../../branding/useBrand";
import { MetricCard } from "../shared/MetricCard";
import { TransactionOverviewCard } from "./TransactionOverviewCard";
import { VolumeTrendAreaCard } from "./VolumeTrendAreaCard";
import { SecondaryChartsGrid } from "./DashboardChartGrids";
import { DashboardStagger, DashboardStaggerItem } from "./DashboardMotion";

function pieValue(rows, name) {
  const row = (rows || []).find((r) => r.name === name);
  return row ? Number(row.value) || 0 : 0;
}

export function AccountsBentoGrid({ statsData, metrics, lockInstitution = false }) {
  const { brand } = useBrand();

  const {
    successVolumes7d = [],
    failedTop5Codes = [],
    transactionsByChannel = [],
    failureByInstitution = [],
    successFailurePie = [],
    channelPie = [],
    averageTime = { ne: 0, ft: 0 },
  } = statsData ?? {};

  const chartColors = brand.theme.chart;

  const pendingCount = useMemo(() => pieValue(successFailurePie, "Pending"), [successFailurePie]);
  const failedCount = useMemo(
    () => pieValue(successFailurePie, "Failed") + pieValue(successFailurePie, "Failed / Other"),
    [successFailurePie],
  );

  const successRateNum = parseFloat(String(metrics?.successRate || "").replace("%", ""));
  const successTrend =
    Number.isFinite(successRateNum) && successRateNum > 0
      ? { isPositive: successRateNum >= 50, value: metrics.successRate }
      : null;

  const topFailed = failedTop5Codes?.[0];
  const topFailedCount = topFailed ? Number(topFailed.count) || 0 : 0;

  return (
    <div className="space-y-5">
      <DashboardStagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStaggerItem>
          <MetricCard title="Transaction Volume" value={metrics.totalTransactions} icon={ArrowLeftRight} iconAccent="yellow" />
        </DashboardStaggerItem>
        <DashboardStaggerItem>
          <MetricCard title="Transaction Value" value={metrics.volume} icon={Banknote} iconAccent="lime" />
        </DashboardStaggerItem>
        <DashboardStaggerItem>
          <MetricCard
            title="Success Rate"
            value={metrics.successRate}
            icon={CheckCircle}
            iconAccent="lime"
            subtitle={`${metrics.successCount ?? 0} successful`}
            gauge={Number.isFinite(successRateNum) ? successRateNum : undefined}
            trend={successTrend}
            footerTrend
          />
        </DashboardStaggerItem>
        <DashboardStaggerItem>
          <MetricCard
            title="Pending"
            value={pendingCount.toLocaleString()}
            icon={Clock}
            iconAccent="yellow"
            subtitle={failedCount > 0 ? `${failedCount.toLocaleString()} failed` : undefined}
            trend={
              pendingCount > 0
                ? { isPositive: false, value: `${pendingCount.toLocaleString()} in queue` }
                : { isPositive: true, value: "None pending" }
            }
            footerTrend
          />
        </DashboardStaggerItem>
      </DashboardStagger>

      <DashboardStagger className="grid grid-cols-1 gap-5 lg:grid-cols-4 lg:grid-rows-[auto_auto]">
        <DashboardStaggerItem className="lg:col-span-2 lg:row-span-2">
          <TransactionOverviewCard metrics={metrics} successFailurePie={successFailurePie} />
        </DashboardStaggerItem>

        <DashboardStaggerItem className="lg:col-span-1">
          <MetricCard
            title="Avg NE Time"
            value={`${averageTime?.ne ?? 0}s`}
            icon={Clock}
            iconAccent="burgundy"
            size="compact"
            subtitle="Name enquiry"
          />
        </DashboardStaggerItem>

        <DashboardStaggerItem className="lg:col-span-1">
          <MetricCard
            title="Top Failed Code"
            value={topFailed?.code ?? "—"}
            icon={AlertTriangle}
            iconAccent="orange"
            size="compact"
            subtitle={topFailedCount > 0 ? `${topFailedCount.toLocaleString()} occurrences` : "No failures"}
          />
        </DashboardStaggerItem>

        <DashboardStaggerItem className="lg:col-span-2">
          <VolumeTrendAreaCard successVolumes7d={successVolumes7d} />
        </DashboardStaggerItem>
      </DashboardStagger>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Detailed breakdown</h2>
        <SecondaryChartsGrid
          lockInstitution={lockInstitution}
          failedTop5Codes={failedTop5Codes}
          transactionsByChannel={transactionsByChannel}
          channelPie={channelPie}
          failureByInstitution={failureByInstitution}
          chartColors={chartColors}
        />
      </div>
    </div>
  );
}
