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
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function FailedCodesPage() {
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
      setRows(data.failedTop5Codes || []);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load failed response-code data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const totalFailed = useMemo(() => rows.reduce((s, r) => s + (Number(r.count) || 0), 0), [rows]);

  const tableColumns = [
    { header: "Code", accessor: (r) => r.code },
    { header: "Description", accessor: (r) => r.description || "Unknown" },
    { header: "Count", accessor: (r) => formatCountNg(r.count) },
    {
      header: "% of failures",
      accessor: (r) => (totalFailed > 0 ? `${((Number(r.count) / totalFailed) * 100).toFixed(1)}%` : "—"),
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
      title="Failed transactions (top response codes)"
      subtitle="Sorted by failure count for the selected period"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="failed-response-codes.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution, status: "failed" })}
      chart={
        rows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No failed response-code data was returned.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="code" width={95} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [formatCountNg(v), "Count"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.code} — ${row.description || "Unknown"}` : "";
                }}
              />
              <Bar dataKey="count" name="Volume" radius={[0, 4, 4, 0]}>
                {rows.map((entry, index) => (
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
