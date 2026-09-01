import { useEffect, useState } from "react";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { StatisticsDrilldownLayout } from "../../../components/dashboard/StatisticsDrilldownLayout";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

const FT_TARGET_SECS = 3;

export default function AverageTimePage() {
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
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

  const ftPct = Math.min(100, (Number(averageTime.ft) / FT_TARGET_SECS) * 100);

  return (
    <StatisticsDrilldownLayout
      title="Average processing time"
      subtitle={`FT target: ${FT_TARGET_SECS}s`}
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
              {Number(averageTime.ft) <= FT_TARGET_SECS ? "Within target" : "Above target"}
            </p>
          </div>
        </dl>
      }
    />
  );
}
