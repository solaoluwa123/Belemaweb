import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { StatisticsSection } from "../../../components/dashboard/StatisticsSection";
import { useAuth } from "../../../context/AuthContext";
import { defaultDashboardDateRange, normalizeDashboardDateRange } from "../../../services/dashboards";
import {
  dashboardFiltersToSearchParams,
  parseDashboardFiltersFromSearch,
} from "../../../utils/dashboardFilterParams";

function readFiltersFromLocationSearch() {
  if (typeof window === "undefined") {
    return { dateRange: null, institution: "all" };
  }
  return parseDashboardFiltersFromSearch(window.location.search);
}

export default function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isThirdPartyVendor } = useAuth();
  const vendor = isThirdPartyVendor();

  const [statsDateRange, setStatsDateRange] = useState(() => {
    const { dateRange } = readFiltersFromLocationSearch();
    return dateRange ?? defaultDashboardDateRange(7);
  });
  const [statsInstitution, setStatsInstitution] = useState(() => {
    const { institution } = readFiltersFromLocationSearch();
    return institution && institution !== "all" ? institution : "all";
  });

  useEffect(() => {
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
