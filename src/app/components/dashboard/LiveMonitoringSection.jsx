import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "../ui/button";
import { RateChartPanel } from "./RateChartPanel";
import { DashboardStagger, DashboardStaggerItem } from "./DashboardMotion";
import { DASHBOARD_AUTO_REFRESH_MS, fetchLiveMonitoringData } from "../../services/dashboards";
import { APIError } from "../../services/api";

export function LiveMonitoringSection({
  institutionCode,
  compact = false,
  autoRefresh = false,
  showHeader = true,
  className = "",
}) {
  const [state, setState] = useState({
    rows: [],
    unsupported: false,
    message: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const loadingRef = useRef(false);

  const loadMonitoring = useCallback(
    async ({ silent = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage("");
      try {
        const nextState = await fetchLiveMonitoringData({ institutionCode });
        setState(nextState);
      } catch (error) {
        setState({ rows: [], unsupported: false, message: "" });
        setErrorMessage(
          error instanceof APIError ? error.message : "Unable to load live monitoring data.",
        );
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        loadingRef.current = false;
      }
    },
    [institutionCode],
  );

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      loadMonitoring({ silent: true });
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadMonitoring]);

  const gridClass = compact
    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className={`space-y-4 ${className}`.trim()} aria-labelledby="live-monitoring-heading">
      {showHeader ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Activity className="h-6 w-6 shrink-0 text-[#00411A]" aria-hidden />
            <div className="min-w-0">
              <h2 id="live-monitoring-heading" className="text-lg font-semibold text-slate-900">
                Live Rates Monitoring
              </h2>
              <p className="text-sm text-slate-500">
                Success rates by institution · last 90 minutes
                {autoRefresh ? " · refreshing every 30s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMonitoring()}
            disabled={isLoading || isRefreshing}
            className="gap-2"
          >
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {state.unsupported || state.message ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message || "Live monitoring is unavailable for this account."}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading live monitoring...
          </span>
        </div>
      ) : state.rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          No live monitoring data for the selected window.
        </div>
      ) : (
        <DashboardStagger className={gridClass}>
          {state.rows.map((institution) => (
            <DashboardStaggerItem key={institution.name}>
              <RateChartPanel institution={institution} compact={compact} />
            </DashboardStaggerItem>
          ))}
        </DashboardStagger>
      )}
    </section>
  );
}
