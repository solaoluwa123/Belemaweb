import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  buildTransactionListLink,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { appendDashboardFiltersToPath } from "../../../utils/dashboardFilterParams";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function ByInstitutionPage() {
  const navigate = useNavigate();
  const { brand } = useBrand();
  const { isThirdPartyVendor } = useAuth();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const handleBarClick = (payload) => {
    if (payload?.institutionCode || payload?.name) {
      const path = `/dashboard/statistics/institution/${encodeURIComponent(payload.institutionCode || payload.name)}`;
      navigate(appendDashboardFiltersToPath(path, { dateRange, institution }));
    }
  };

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setRows(data.failureByInstitution || []);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load institution failure data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isThirdPartyVendor()) return;
    loadPage();
  }, [fetchOptions]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.count) || 0), 0), [rows]);

  const tableColumns = [
    { header: "Institution", accessor: (r) => r.name },
    { header: "Code", accessor: (r) => r.institutionCode || "—" },
    { header: "Failures", accessor: (r) => formatCountNg(r.count) },
    {
      header: "Share",
      accessor: (r) => (total > 0 ? `${((Number(r.count) / total) * 100).toFixed(1)}%` : "—"),
    },
  ];

  if (isThirdPartyVendor()) {
    return <Navigate to="/dashboard/statistics" replace />;
  }

  return (
    <StatisticsDrilldownLayout
      title="Failure by destination institution"
      subtitle="Click a bar to view return code breakdown for that institution"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="failures-by-institution.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        rows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No institution failure data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={90} tick={{ fontSize: 11 }} interval={0} />
              <YAxis />
              <Tooltip
                formatter={(v) => [formatCountNg(v), "Failures"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.name}${row.institutionCode ? ` (${row.institutionCode})` : ""}` : "";
                }}
                cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
              />
              <Bar dataKey="count" name="Failures" radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" onClick={handleBarClick}>
                {rows.map((entry, index) => (
                  <Cell key={entry.name || entry.institutionCode} fill={entry.fill || brand.theme.chart[index % brand.theme.chart.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
