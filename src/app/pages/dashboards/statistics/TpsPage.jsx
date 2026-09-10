import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import {
  StatisticsDrilldownLayout,
  buildTransactionListLink,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

function formatTpsValue(value) {
  const n = Number(value) || 0;
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export default function TpsPage() {
  const { brand } = useBrand();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const [rows, setRows] = useState([]);
  const [tpsMeta, setTpsMeta] = useState({ peakTps: 0, avgTps: 0, bucketSeconds: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData(fetchOptions);
      setRows(data.tpsSeries || []);
      setTpsMeta(data.tpsMeta || { peakTps: 0, avgTps: 0, bucketSeconds: 0 });
    } catch (error) {
      setRows([]);
      setTpsMeta({ peakTps: 0, avgTps: 0, bucketSeconds: 0 });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load TPS data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [fetchOptions]);

  const bucketLabel = useMemo(() => {
    const secs = Number(tpsMeta.bucketSeconds) || 0;
    if (secs >= 3600) return `${Math.round(secs / 3600)}h buckets`;
    if (secs >= 60) return `${Math.round(secs / 60)}m buckets`;
    if (secs > 0) return `${secs}s buckets`;
    return "time buckets";
  }, [tpsMeta.bucketSeconds]);

  const tableColumns = [
    { header: "Time", accessor: (r) => r.date || r.label },
    { header: "TPS", accessor: (r) => formatTpsValue(r.tps) },
    { header: "Txn count", accessor: (r) => formatCountNg(r.volume) },
  ];

  const stroke = brand?.theme?.chart?.[0] ?? "#00411A";

  return (
    <StatisticsDrilldownLayout
      title="Transactions per second"
      subtitle={`Throughput over time (${bucketLabel}). Peak ${formatTpsValue(tpsMeta.peakTps)} · Avg ${formatTpsValue(tpsMeta.avgTps)}`}
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename="transactions-tps.csv"
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        rows.length === 0 ? (
          <p className="py-12 text-center text-slate-500">No TPS data was returned for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="tpsDrillFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatTpsValue} width={48} />
              <Tooltip
                formatter={(v, _n, item) => [
                  `${formatTpsValue(v)} TPS (${formatCountNg(item?.payload?.volume)} txns)`,
                  "Throughput",
                ]}
              />
              <Area
                type="monotone"
                dataKey="tps"
                name="TPS"
                stroke={stroke}
                strokeWidth={2.25}
                fill="url(#tpsDrillFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
