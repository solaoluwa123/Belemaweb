import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TRANSGATE_BANKS } from "../../../data/mockData";
import { fetchInstitutionFailedCodeBreakdown } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import { useAuth } from "../../../context/AuthContext";
import { useParams } from "react-router";
import {
  StatisticsDrilldownLayout,
  buildTransactionListLink,
  formatCountNg,
} from "../../../components/dashboard/StatisticsDrilldownLayout";
import { useStatisticsPageFilters } from "./useStatisticsPageFilters";

export default function InstitutionDetailPage() {
  const { institutionName } = useParams();
  const { brand } = useBrand();
  const { user, isThirdPartyVendor } = useAuth();
  const { dateRange, institution, fetchOptions } = useStatisticsPageFilters();
  const vendorCode = String(user?.institutionCode || "").trim();
  const institutionKey = institutionName ? decodeURIComponent(institutionName) : "";
  const resolvedInstitution = useMemo(() => {
    const lowerKey = institutionKey.toLowerCase();
    return (
      TRANSGATE_BANKS.find((bank) => bank.id.toLowerCase() === lowerKey || bank.name.toLowerCase() === lowerKey) ?? null
    );
  }, [institutionKey]);
  const displayName = resolvedInstitution?.name || institutionKey || "Institution";
  const institutionCode = resolvedInstitution?.id || institutionKey;
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    if (!institutionCode) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchInstitutionFailedCodeBreakdown({
        institutionCode,
        dateRange: fetchOptions.dateRange,
      });
      setRows(data);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load institution response-code breakdown.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isThirdPartyVendor() && (!vendorCode || String(institutionCode) !== vendorCode)) {
      return;
    }
    loadPage();
  }, [institutionCode, vendorCode, fetchOptions.dateRange?.start?.getTime(), fetchOptions.dateRange?.end?.getTime()]);

  const tableColumns = [
    { header: "Code", accessor: (r) => r.code },
    { header: "Description", accessor: (r) => r.description || "Unknown" },
    { header: "Count", accessor: (r) => formatCountNg(r.count) },
  ];

  if (isThirdPartyVendor() && (!vendorCode || String(institutionCode) !== vendorCode)) {
    return <Navigate to="/dashboard/statistics" replace />;
  }

  return (
    <StatisticsDrilldownLayout
      title={displayName}
      subtitle="Failed transactions by return code"
      dateRange={dateRange}
      institution={institution}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRefresh={loadPage}
      csvFilename={`institution-${institutionCode}-failures.csv`}
      tableColumns={tableColumns}
      tableRows={rows}
      transactionLink={buildTransactionListLink({ dateRange, institution })}
      chart={
        rows.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No breakdown data for this institution.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="code" angle={-25} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip
                formatter={(v) => [formatCountNg(v), "Count"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.code} — ${row.description || "Unknown"}` : "";
                }}
              />
              <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {rows.map((entry, i) => (
                  <Cell key={entry.code} fill={entry.fill || brand.theme.chart[i % brand.theme.chart.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    />
  );
}
