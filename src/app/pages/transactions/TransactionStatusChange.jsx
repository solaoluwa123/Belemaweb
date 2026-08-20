import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { CheckCircle, Loader2, RefreshCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  fetchTransactionStatusChanges,
  requestTransactionStatusChange,
} from "../../services/transactions";
import { toast } from "sonner";
import { formatBackendDateTime } from "../../utils/formatters";

/**
 * Admin-only: list pending (09) fund transfers and apply Successful/Failed immediately.
 * No approval queue.
 */
export default function TransactionStatusChange() {
  const { user, isAdmin, canRequestStatusChange } = useAuth();
  const admin = typeof isAdmin === "function" ? isAdmin() : false;
  const canChange = typeof canRequestStatusChange === "function" ? canRequestStatusChange() : admin;
  const requester = String(user?.username || user?.email || "").trim();

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [targetStatus, setTargetStatus] = useState("Successful");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadItems = async (sessionId = sessionFilter) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchTransactionStatusChanges({
        sessionId: String(sessionId || "").trim() || undefined,
        limit: 100,
      });
      setItems(rows.map((row) => ({ ...row, status: row.status || "Pending" })));
    } catch (error) {
      setItems([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load pending transactions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canChange) loadItems("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canChange]);

  if (!canChange) {
    return <Navigate to="/transactions" replace />;
  }

  const openChange = (row) => {
    setActiveRow(row);
    setTargetStatus("Successful");
    setReason("");
    setDialogOpen(true);
  };

  const applyStatus = async () => {
    if (!activeRow || !requester) return;
    const note = reason.trim();
    if (!note) {
      toast.error("Enter a reason for the status change.");
      return;
    }
    const sessionId = String(activeRow.sessionId || activeRow.id || "").trim();
    if (!sessionId) {
      toast.error("Missing session id.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestTransactionStatusChange({
        transactionId: sessionId,
        newStatus: targetStatus,
        reason: note,
        username: requester,
        status: targetStatus,
      });
      const status = String(result?.status || "").toLowerCase();
      const message = String(result?.message || "").trim();
      if (status === "failed" || status === "error") {
        throw new APIError(message || "Status change failed.", 400, result);
      }
      toast.success(message || `Status changed to ${targetStatus}.`);
      setDialogOpen(false);
      setActiveRow(null);
      await loadItems();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to change transaction status.");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: "sessionId", label: "Session ID", sortable: true },
    {
      key: "dateTime",
      label: "Date",
      sortable: true,
      render: (value) => formatBackendDateTime(value),
    },
    { key: "sourceAccountName", label: "From" },
    { key: "sourceBank", label: "Source bank" },
    { key: "beneficiaryAccountName", label: "To" },
    { key: "beneficiaryBank", label: "Destination bank" },
    {
      key: "amount",
      label: "Amount",
      render: (value) => `₦${Number(value || 0).toLocaleString()}`,
    },
    {
      key: "responseCode",
      label: "Code",
      render: (value, row) => value || row.raw?.srcResponsecode || "09",
    },
    {
      key: "status",
      label: "Status",
      render: (value, row) => <StatusBadge status={row.status} />,
    },
  ];

  const actions = (row) => (
    <Button type="button" size="sm" className="h-8" onClick={() => openChange(row)}>
      Change status
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Status Change</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrator only. Pending (09) transfers are updated immediately — no approval required.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadItems()} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-4">
        <div className="min-w-[240px] flex-1 space-y-2">
          <Label htmlFor="session-filter">Session ID filter</Label>
          <Input
            id="session-filter"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            placeholder="Optional exact session id"
          />
        </div>
        <Button type="button" onClick={() => loadItems(sessionFilter)} disabled={isLoading}>
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSessionFilter("");
            loadItems("");
          }}
          disabled={isLoading}
        >
          Clear
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <DataTable
        data={items}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        emptyMessage="No pending (09) transactions found for status update."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change transaction status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Session: <strong className="break-all">{activeRow?.sessionId || "—"}</strong>
            </p>
            <p className="text-xs text-amber-700">
              This applies immediately. There is no secondary approval step.
            </p>
            <div className="space-y-2">
              <Label>New status</Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Successful">Successful (00)</SelectItem>
                  <SelectItem value="Failed">Failed (91)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-reason">Reason</Label>
              <Input
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={applyStatus} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Apply now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
