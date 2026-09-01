import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  buildTransactionListLink,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { formatCompactCount } from "../../../utils/dashboardChartUtils";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function ByChannelPage() {
  const { brand } = useBrand();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setRows(data.transactionsByChannel || []);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load transactions-by-channel data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.count) || 0), 0), [rows]);

  const tableColumns = [
    { header: "Channel", accessor: (r) => r.channel },
    { header: "Count", accessor: (r) => formatCountNg(r.count) },
    {
      header: "Share",
      accessor: (r) => (total > 0 ? `${((Number(r.count) / total) * 100).toFixed(1)}%` : "—"),
    },
  ];

  return (
    <StatisticsDrilldownLayout
      title="Transactions by channel"
      subtitle="Volume distribution across payment channels"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="transactions-by-channel.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        rows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No transaction-by-channel data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="channel" angle={-25} textAnchor="end" height={70} />
              <YAxis tickFormatter={formatCompactCount} />
              <Tooltip formatter={(v) => [formatCountNg(v), "Count"]} />
              <Bar dataKey="count" fill={brand.theme.chart[2]} radius={[4, 4, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
