import { useEffect, useState } from "react";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { StatisticsDrilldownLayout } from "../../../components/dashboard/StatisticsDrilldownLayout";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";
import { useBrand } from "../../../../branding/useBrand";

export default function AverageTimePage() {
  const { brand } = useBrand();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const ftTargetSeconds = brand?.dashboard?.ftTargetSeconds ?? 3;
  const [averageTime, setAverageTime] = useState({ ne: 0, ft: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setAverageTime(data.averageTime || { ne: 0, ft: 0 });
    } catch (error) {
      setAverageTime({ ne: 0, ft: 0 });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load average-time metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const ftPct = Math.min(100, (Number(averageTime.ft) / ftTargetSeconds) * 100);

  return (
    <StatisticsDrilldownLayout
      title="Average processing time"
      subtitle={`FT target: ${ftTargetSeconds}s`}
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      chart={
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <dt className="text-sm font-medium text-slate-500">NE</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{averageTime.ne} secs</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <dt className="text-sm font-medium text-slate-500">FT</dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{Number(averageTime.ft || 0).toFixed(1)} secs</dd>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#00411A] transition-all"
                style={{ width: `${ftPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {Number(averageTime.ft) <= ftTargetSeconds ? "Within target" : "Above target"}
            </p>
          </div>
        </dl>
      }
    />
  );
}
