import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";
import { useAuth } from "../../../context/AuthContext";

export default function ByChannelPage() {
  const navigate = useNavigate();
  const { brand } = useBrand();
  const { user, requiresInstitutionScope } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData({
        institutionCode: requiresInstitutionScope() ? user?.institutionCode : undefined,
        requireInstitutionScope: requiresInstitutionScope(),
      });
      setRows(data.transactionsByChannel);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load transactions-by-channel data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

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
          <CardTitle>Transactions by Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading channels...
              </span>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No transaction-by-channel data was returned.</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="channel" angle={-25} textAnchor="end" height={70} />
                <YAxis tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Count"]} />
                <Bar dataKey="count" fill={brand.theme.chart[2]} radius={[4, 4, 0, 0]} name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
