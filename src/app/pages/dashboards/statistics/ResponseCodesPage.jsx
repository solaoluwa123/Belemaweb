import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  buildTransactionListLink,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { Button } from "../../../components/ui/button";
import { ExternalLink } from "lucide-react";
import { formatCompactCount } from "../../../utils/dashboardChartUtils";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function ResponseCodesPage() {
  const navigate = useNavigate();
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
      setRows(data.responseCodeVolumes || []);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load response-code volume data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const chartRows = useMemo(
    () =>
      (rows || []).map((row) => ({
        ...row,
        category: `${row.code} — ${row.description || "Unknown"}`,
      })),
    [rows],
  );

  const totalVolume = useMemo(() => rows.reduce((s, r) => s + (Number(r.count) || 0), 0), [rows]);
  const chartHeight = Math.max(360, 48 + chartRows.length * 36);

  const tableColumns = [
    { header: "Code", accessor: (r) => r.code },
    { header: "Status message", accessor: (r) => r.description || "Unknown" },
    { header: "Count", accessor: (r) => formatCountNg(r.count) },
    {
      header: "% of volume",
      accessor: (r) => (totalVolume > 0 ? `${((Number(r.count) / totalVolume) * 100).toFixed(1)}%` : "—"),
    },
    {
      header: "Actions",
      accessor: () => "",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 h-8 px-2"
          onClick={() =>
            navigate(buildTransactionListLink({ responseCode: r.code, dateRange, institution }))
          }
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Search
        </Button>
      ),
    },
  ];

  return (
    <StatisticsDrilldownLayout
      title="Response codes"
      subtitle="Top response codes by transaction volume for the selected period (includes successful)"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="response-code-volumes.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        chartRows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No response-code volume data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              layout="vertical"
              data={chartRows}
              margin={{ top: 10, right: 24, left: 8, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={formatCompactCount} />
              <YAxis type="category" dataKey="category" width={220} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [formatCountNg(v), "Count"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.code} — ${row.description || "Unknown"}` : "";
                }}
              />
              <Bar dataKey="count" name="Volume" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartRows.map((entry, index) => (
                  <Cell key={entry.code} fill={entry.fill || brand.theme.chart[index % brand.theme.chart.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
