import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
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
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

function DestinationRateTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{row.name}</p>
      {row.institutionCode ? <p className="text-slate-500">Code: {row.institutionCode}</p> : null}
      <p className="mt-1 text-slate-900">Success rate: {Number(row.successRate || 0).toFixed(1)}%</p>
      <p className="text-slate-500">
        {formatCountNg(row.successCount)} / {formatCountNg(row.totalCount)} approved (00)
      </p>
      <p className="text-slate-500">Share of volume: {Number(row.sharePercent || 0).toFixed(1)}%</p>
    </div>
  );
}

export default function DestinationSuccessRatesPage() {
  const { brand } = useBrand();
  const { isThirdPartyVendor } = useAuth();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setRows(data.destinationSuccessRates || []);
    } catch (error) {
      setRows([]);
      setErrorMessage(
        error instanceof APIError ? error.message : "Unable to load destination success rates.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isThirdPartyVendor()) return;
    loadPage();
  }, [fetchOptions]);

  const chartRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        shareLabel: `${Number(row.sharePercent || 0).toFixed(1)}%`,
      })),
    [rows],
  );

  const tableColumns = [
    { header: "Destination bank", accessor: (r) => r.name },
    { header: "Code", accessor: (r) => r.institutionCode || "—" },
    {
      header: "Success rate",
      headerTooltip: "Fully approved (response code 00) ÷ total transfers to this destination",
      accessor: (r) => `${Number(r.successRate || 0).toFixed(1)}%`,
    },
    {
      header: "Approved (00)",
      accessor: (r) => formatCountNg(r.successCount),
    },
    {
      header: "Total volume",
      accessor: (r) => formatCountNg(r.totalCount),
    },
    {
      header: "Share of volume",
      headerTooltip: "This destination’s share of total outbound volume in the period",
      accessor: (r) => `${Number(r.sharePercent || 0).toFixed(1)}%`,
    },
  ];

  if (isThirdPartyVendor()) {
    return <Navigate to="/dashboard/statistics" replace />;
  }

  return (
    <StatisticsDrilldownLayout
      title="Success rate by destination bank"
      subtitle="Banks you send to — success rate uses full approval (00) only. Labels show share of total volume."
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="destination-success-rates.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        chartRows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No destination success-rate data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <BarChart data={chartRows} margin={{ top: 20, right: 10, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={90} tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<DestinationRateTooltip />} cursor={{ fill: "rgba(59, 130, 246, 0.1)" }} />
              <Bar dataKey="successRate" name="Success rate" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartRows.map((entry, index) => (
                  <Cell
                    key={entry.name || entry.institutionCode}
                    fill={entry.fill || brand.theme.chart[index % brand.theme.chart.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
