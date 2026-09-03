import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { formatCompactCount, formatNairaFull } from "../../../utils/dashboardChartUtils";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function SuccessfulTransactionsPage() {
  const { brand } = useBrand();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [chartRows, setChartRows] = useState([]);
  const [trendRows, setTrendRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setChartRows(data.successVolumes7d || []);
      setTrendRows(data.chartData7d || []);
    } catch (error) {
      setChartRows([]);
      setTrendRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load successful transaction volumes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const tableRows = useMemo(() => {
    if (trendRows.length) {
      return trendRows.map((row) => ({
        id: row.date,
        date: row.date,
        volume: row.transactions,
        value: row.amount,
      }));
    }
    return chartRows.map((row) => ({
      id: row.date,
      date: row.date,
      volume: row.volume,
      value: null,
    }));
  }, [chartRows, trendRows]);

  const tableColumns = [
    { header: "Date", accessor: (r) => r.date },
    { header: "Volume", accessor: (r) => formatCountNg(r.volume) },
    {
      header: "Value",
      accessor: (r) => (r.value != null ? formatNairaFull(r.value) : "—"),
    },
  ];

  const chartData = trendRows.length
    ? trendRows
    : chartRows.map((r) => ({ date: r.date, transactions: r.volume, amount: undefined }));
  const showDots = chartData.length <= 2;

  return (
    <StatisticsDrilldownLayout
      title="Transaction volume & value"
      subtitle="Daily transaction volume and value trend for the selected period"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="successful-transactions.csv"
      tableColumns={tableColumns}
      tableRows={tableRows}
      chart={
        chartData.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No transaction volume data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 10, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="volume" tickFormatter={formatCompactCount} />
              <YAxis yAxisId="value" orientation="right" tickFormatter={(v) => `₦${formatCompactCount(v)}`} />
              <Tooltip
                formatter={(v, name) => [
                  name === "Value" ? formatNairaFull(v) : formatCountNg(v),
                  name,
                ]}
              />
              <Legend />
              <Line
                yAxisId="volume"
                type="monotone"
                dataKey="transactions"
                name="Volume"
                stroke={brand.theme.chart[0]}
                strokeWidth={2.5}
                dot={{ r: showDots ? 4 : 3, fill: brand.theme.chart[0] }}
                activeDot={{ r: 5 }}
              />
              {trendRows.length ? (
                <Line
                  yAxisId="value"
                  type="monotone"
                  dataKey="amount"
                  name="Value"
                  stroke={brand.theme.chart[1]}
                  strokeWidth={2.5}
                  dot={{ r: showDots ? 4 : 3, fill: brand.theme.chart[1] }}
                  activeDot={{ r: 5 }}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
