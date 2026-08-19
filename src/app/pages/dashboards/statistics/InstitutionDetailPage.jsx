import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TRANSGATE_BANKS } from "../../../data/mockData";
import { fetchInstitutionFailedCodeBreakdown } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import { useAuth } from "../../../context/AuthContext";

export default function InstitutionDetailPage() {
  const navigate = useNavigate();
  const { institutionName } = useParams();
  const { brand } = useBrand();
  const { user, isThirdPartyVendor } = useAuth();
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
      const data = await fetchInstitutionFailedCodeBreakdown({ institutionCode });
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
  }, [institutionCode, vendorCode, isThirdPartyVendor]);

  if (isThirdPartyVendor() && (!vendorCode || String(institutionCode) !== vendorCode)) {
    return <Navigate to="/dashboard/statistics" replace />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="outline" onClick={loadPage} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{displayName}</CardTitle>
          <p className="text-sm text-slate-500">Failed transactions by return code.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading response-code breakdown...
              </span>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 py-8">No breakdown data for this institution.</p>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" angle={-25} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Count"]} />
                <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                  {rows.map((entry, i) => (
                    <Cell key={entry.code} fill={entry.fill || brand.theme.chart[i % brand.theme.chart.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
