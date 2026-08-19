import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Activity, Loader2, RefreshCcw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Button } from "../../components/ui/button";
import { fetchLiveMonitoringData } from "../../services/dashboards";
import { APIError } from "../../services/api";

const INFLOW_COLOR = "#22c55e";
const OUTFLOW_COLOR = "#ef4444";

function RateChartPanel({ institution }) {
  const { name, timeSeries, inflowSuccess, inflowFailure, outflowSuccess, outflowFailure, yAxisDomain } = institution;
  const domain = yAxisDomain ?? [0, 80];

  return (
    <Card className="h-full gap-2 border-slate-200">
      <CardHeader className="space-y-0 pb-1 pt-4">
        <CardTitle className="truncate text-sm font-medium text-slate-900" title={name}>
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-green-500" aria-hidden />
            Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded bg-red-500" aria-hidden />
            Outflow
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={timeSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              formatter={(value) => [value, null]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend
              wrapperStyle={{ display: "none" }}
              formatter={() => null}
            />
            {domain[1] > 10 && (
              <>
                <ReferenceLine y={40} stroke="#ef4444" strokeWidth={1} />
                <ReferenceLine y={80} stroke="#0f172a" strokeWidth={1} />
              </>
            )}
            <Line
              type="monotone"
              dataKey="inflow"
              name="Inflow"
              stroke={INFLOW_COLOR}
              strokeWidth={2}
              dot={{ fill: INFLOW_COLOR, r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="outflow"
              name="Outflow"
              stroke={OUTFLOW_COLOR}
              strokeWidth={2}
              dot={{ fill: OUTFLOW_COLOR, r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-x-4 text-[10px] text-slate-600">
          <div className="flex flex-col gap-0.5">
            <div>Inflow Success: {inflowSuccess}%</div>
            <div>Inflow Failure: {inflowFailure}%</div>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <div>Outflow Success: {outflowSuccess}%</div>
            <div>Outflow Failure: {outflowFailure}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveMonitoring() {
  const { isThirdPartyVendor } = useAuth();
  const [state, setState] = useState({
    rows: [],
    unsupported: false,
    message: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const loadingRef = useRef(false);

  const loadMonitoring = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const nextState = await fetchLiveMonitoringData();
      setState(nextState);
    } catch (error) {
      setState({ rows: [], unsupported: false, message: "" });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load live monitoring data.");
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  if (isThirdPartyVendor()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Activity className="h-8 w-8 text-blue-600" aria-hidden />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Live Rates Monitoring</h1>
          <p className="mt-1 text-slate-500">Real-time inflow and outflow by institution</p>
        </div>
        <Button variant="outline" onClick={loadMonitoring} disabled={isLoading} className="ml-auto gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {state.unsupported || state.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message || "Live monitoring remains blocked until the backend exposes a confirmed endpoint for this screen."}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading live monitoring...
          </span>
        </div>
      ) : state.rows.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          No live monitoring data was returned.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {state.rows.map((institution) => (
            <RateChartPanel key={institution.name} institution={institution} />
          ))}
        </div>
      )}
    </div>
  );
}
