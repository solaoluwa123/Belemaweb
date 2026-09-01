"use client";

import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import {
  defaultDashboardDateRange,
  normalizeDashboardDateRange,
} from "../../../services/dashboards";
import { parseDashboardFiltersFromSearch } from "../../../utils/dashboardFilterParams";

/** Shared filter state for statistics drill-down pages (URL-synced). */
export function useStatisticsPageFilters() {
  const [searchParams] = useSearchParams();
  const { user, requiresInstitutionScope } = useAuth();
  const requireScope = requiresInstitutionScope();

  const { dateRange, institution: urlInstitution } = useMemo(
    () => parseDashboardFiltersFromSearch(searchParams),
    [searchParams],
  );

  const dateRangeResolved = dateRange ?? defaultDashboardDateRange(7);
  const institution = requireScope
    ? user?.institutionCode || "all"
    : urlInstitution && urlInstitution !== "all"
      ? urlInstitution
      : "all";

  const fetchOptions = useMemo(
    () => ({
      institutionCode:
        institution !== "all" ? institution : requireScope ? user?.institutionCode : null,
      dateRange: normalizeDashboardDateRange(dateRangeResolved),
      requireInstitutionScope: requireScope,
    }),
    [institution, dateRangeResolved, requireScope, user?.institutionCode],
  );

  return { dateRange: dateRangeResolved, institution, fetchOptions };
}
