import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { StatisticsSection } from "../../../components/dashboard/StatisticsSection";
import { useAuth } from "../../../context/AuthContext";
import { defaultDashboardDateRange, normalizeDashboardDateRange } from "../../../services/dashboards";
import {
  dashboardFiltersToSearchParams,
  parseDashboardFiltersFromSearch,
} from "../../../utils/dashboardFilterParams";

export default function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isThirdPartyVendor } = useAuth();
  const vendor = isThirdPartyVendor();
  const urlInitialized = useRef(false);

  const [statsDateRange, setStatsDateRange] = useState(() => defaultDashboardDateRange(7));
  const [statsInstitution, setStatsInstitution] = useState("all");

  useEffect(() => {
    if (urlInitialized.current) return;
    const { dateRange, institution } = parseDashboardFiltersFromSearch(searchParams);
    if (dateRange) setStatsDateRange(dateRange);
    if (institution && institution !== "all" && !vendor) setStatsInstitution(institution);
    urlInitialized.current = true;
  }, [searchParams, vendor]);

  useEffect(() => {
    if (!urlInitialized.current) return;
    const next = dashboardFiltersToSearchParams({
      dateRange: statsDateRange,
      institution: vendor ? user?.institutionCode || "all" : statsInstitution,
    });
    if (searchParams.toString() !== next.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [statsDateRange, statsInstitution, vendor, user?.institutionCode, searchParams, setSearchParams]);

  return (
    <div className="space-y-8">
      <StatisticsSection
        lockInstitution={vendor}
        statsInstitution={vendor ? user?.institutionCode || "" : statsInstitution}
        onInstitutionChange={vendor ? undefined : setStatsInstitution}
        statsDateRange={normalizeDashboardDateRange(statsDateRange)}
        onDateRangeChange={setStatsDateRange}
        institutionDisplayName={vendor ? user?.institutionName || user?.institutionCode : undefined}
      />
    </div>
  );
}
