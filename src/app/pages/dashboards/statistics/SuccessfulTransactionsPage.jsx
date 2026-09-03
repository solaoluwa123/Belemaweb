import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { formatCompactCount, formatNairaFull } from "../../../utils/dashboardChartUtils";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

function VolumeValueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const vol = payload.find((p) => p.dataKey === "transactions");
  const val = payload.find((p) => p.dataKey === "amount");
  const primary = val?.value != null ? formatNairaFull(val.value) : vol ? formatCountNg(vol.value) : null;
  return (
    <div className="min-w-[148px] rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-lg">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      {primary ? <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{primary}</p> : null}
      <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
        {vol ? <p>Volume · {formatCountNg(vol.value)}</p> : null}
        {val?.value != null ? <p>Value · {formatNairaFull(val.value)}</p> : null}
      </div>
    </div>
  );
}

export default function SuccessfulTransactionsPage() {
  const { brand } = useBrand();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [chartRows, setChartRows] = useState([]);
  const [trendRows, setTrendRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const volumeColor = brand.theme.chart[0];
  const valueColor = brand.theme.chart[1];

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
            <ComposedChart data={chartData} margin={{ top: 10, right: 48, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="successVolumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={volumeColor} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={volumeColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="volume"
                tickFormatter={formatCompactCount}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="value"
                orientation="right"
                tickFormatter={(v) => `₦${formatCompactCount(v)}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<VolumeValueTooltip />}
                cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 }}
              />
              <Legend />
              <Area
                yAxisId="volume"
                type="monotone"
                dataKey="transactions"
                name="Volume"
                stroke={volumeColor}
                strokeWidth={2.25}
                fill="url(#successVolumeFill)"
                dot={false}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: volumeColor }}
              />
              {trendRows.length ? (
                <Line
                  yAxisId="value"
                  type="monotone"
                  dataKey="amount"
                  name="Value"
                  stroke={valueColor}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: valueColor }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
