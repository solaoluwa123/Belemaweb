import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Loader2, RefreshCcw, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { fetchTsqRetries, resetTsqRetryCounter } from "../../services/transactions";
import { toast } from "sonner";
import { formatBackendDateTime } from "../../utils/formatters";

const MAX_TSQ_COUNTER = 8;

/**
 * Admin-only: list tbl_tsq_retry rows and reset counter to 0 so TSQ_Service picks them again.
 */
export default function TsqRetry() {
  const { user, isAdmin } = useAuth();
  const admin = typeof isAdmin === "function" ? isAdmin() : false;
  const requester = String(user?.username || user?.email || "").trim();

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadItems = async ({ sessionId = sessionFilter, pageNum = page } = {}) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const result = await fetchTsqRetries({
        page: pageNum,
        limit,
        sessionId: String(sessionId || "").trim() || undefined,
      });
      setItems(result.rows);
      setTotalRecords(result.totalRecords);
      setPage(result.page);
    } catch (error) {
      setItems([]);
      setTotalRecords(0);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load TSQ retries.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (admin) loadItems({ pageNum: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  if (!admin) {
    return <Navigate to="/transactions" replace />;
  }

  const openReset = (row) => {
    setActiveRow(row);
    setDialogOpen(true);
  };

  const applyReset = async () => {
    if (!activeRow || !requester) return;
    const sessionId = String(activeRow.sessionId || "").trim();
    if (!sessionId) {
      toast.error("Missing session id.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetTsqRetryCounter(sessionId, requester);
      const status = String(result?.status || "").toLowerCase();
      const message = String(result?.message || "").trim();
      if (status === "failed" || status === "error") {
        throw new APIError(message || "Reset failed.", 400, result);
      }
      toast.success(message || "TSQ retry counter reset.");
      setDialogOpen(false);
      setActiveRow(null);
      await loadItems();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to reset TSQ retry counter.");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: "sessionId", label: "Session ID", sortable: true },
    {
      key: "transactionDateTime",
      label: "Transaction time",
      sortable: true,
      render: (value) => formatBackendDateTime(value),
    },
    {
      key: "counter",
      label: "Counter",
      sortable: true,
      render: (value) => {
        const n = Number(value || 0);
        const maxed = n >= MAX_TSQ_COUNTER;
        return (
          <span
            className={
              maxed
                ? "inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                : "font-medium text-slate-800"
            }
          >
            {n}
            {maxed ? " (max)" : ""}
          </span>
        );
      },
    },
    { key: "responseCode", label: "Response code" },
    { key: "destinationInstitutionCode", label: "Dest code" },
    { key: "destInstitutionName", label: "Destination" },
    { key: "route", label: "Route" },
  ];

  const actions = (row) => (
    <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => openReset(row)}>
      <RotateCcw className="h-3.5 w-3.5" />
      Reset counter
    </Button>
  );

  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">TSQ Retry</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrator only. Reset a session counter to 0 so the TSQ sender can pick it again after it hits the max
            retry cap.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadItems()} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-4">
        <div className="min-w-[240px] flex-1 space-y-2">
          <Label htmlFor="tsq-session-filter">Session ID filter</Label>
          <Input
            id="tsq-session-filter"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            placeholder="Optional exact session id"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setPage(1);
            loadItems({ sessionId: sessionFilter, pageNum: 1 });
          }}
          disabled={isLoading}
        >
          Apply
        </Button>
      </div>

      <DataTable data={items} columns={columns} actions={actions} isLoading={isLoading} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {totalRecords} record{totalRecords === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              loadItems({ pageNum: next });
            }}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || page >= totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              loadItems({ pageNum: next });
            }}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !submitting && setDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset TSQ counter</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Reset counter to <span className="font-medium">0</span> and response code to{" "}
            <span className="font-medium">09</span> for session{" "}
            <span className="font-mono text-xs">{activeRow?.sessionId}</span>? The TSQ sender can then retry this
            transaction again.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={applyReset} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset counter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
