import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { fetchAccountsDashboardData } from "../../../services/dashboards";
import { APIError } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function AverageTimePage() {
  const navigate = useNavigate();
  const { user, requiresInstitutionScope } = useAuth();
  const [averageTime, setAverageTime] = useState({ ne: 0, ft: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadPage = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchAccountsDashboardData({
        institutionCode: requiresInstitutionScope() ? user?.institutionCode : undefined,
      });
      setAverageTime(data.averageTime);
    } catch (error) {
      setAverageTime({ ne: 0, ft: 0 });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load average-time metrics.");
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
          <CardTitle>Average Time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading average-time metrics...
              </span>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-sm font-medium text-slate-500">NE</dt>
              <dd className="text-2xl font-bold text-slate-900 mt-1">{averageTime.ne} secs</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-sm font-medium text-slate-500">FT</dt>
              <dd className="text-2xl font-bold text-slate-900 mt-1">{averageTime.ft.toFixed(2)} secs</dd>
            </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
