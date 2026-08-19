import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useBrand } from "../../../../branding/useBrand";

export default function ByInstitutionPage() {
  const navigate = useNavigate();
  const { brand } = useBrand();
  const { isThirdPartyVendor } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const handleBarClick = (payload) => {
    if (payload?.institutionCode || payload?.name) {
      navigate(`/dashboard/statistics/institution/${encodeURIComponent(payload.institutionCode || payload.name)}`);
    }
  };

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData();
      setRows(data.failureByInstitution);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load institution failure data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  if (isThirdPartyVendor()) {
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
          <CardTitle>Failure by destination institution</CardTitle>
          <p className="text-sm text-slate-500">Click a bar to view return code breakdown for that institution.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading institution failures...
              </span>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No institution failure data was returned.</p>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 30, left: 140, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={135} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Failures"]} cursor={{ fill: "rgba(59, 130, 246, 0.1)" }} />
                <Bar dataKey="count" name="Failures" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleBarClick}>
                  {rows.map((entry, index) => (
                    <Cell key={entry.name || entry.institutionCode} fill={entry.fill || brand.theme.chart[index % brand.theme.chart.length]} />
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
