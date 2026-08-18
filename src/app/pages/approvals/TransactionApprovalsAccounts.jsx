import { useEffect, useState } from "react";
import { Link } from "react-router";
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
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import { fetchTransactionStatusChanges } from "../../services/transactions";
import { toast } from "sonner";
import { formatBackendDateTime } from "../../utils/formatters";

export default function TransactionApprovalsAccounts() {
  const { user, isApprover, isOperator } = useAuth();
  const canApprove = isApprover();
  const canSubmit = isOperator();
  const requester = String(user?.username || user?.email || "").trim();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeRow, setProposeRow] = useState(null);
  const [proposeTarget, setProposeTarget] = useState("Successful");
  const [proposeReason, setProposeReason] = useState("");
  const [proposeSubmitting, setProposeSubmitting] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchTransactionStatusChanges();
      setItems(rows.map((row) => ({ ...row, status: row.status || "Pending" })));
    } catch (error) {
      setItems([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load account transaction approvals.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openPropose = (row) => {
    setProposeRow(row);
    setProposeTarget("Successful");
    setProposeReason("");
    setProposeOpen(true);
  };

  const submitProposedStatus = async () => {
    if (!proposeRow || !requester) return;
    const reason = proposeReason.trim() || `Proposed ${proposeTarget} from transaction status queue`;
    setProposeSubmitting(true);
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.TRANSACTION_STATUS_DECISION,
        summary: `Transaction ${proposeRow.sessionId || proposeRow.id} → ${proposeTarget}`,
        payload: {
          queueItemId: String(proposeRow.id || ""),
          sessionId: String(proposeRow.sessionId || ""),
          targetStatus: proposeTarget,
          reason,
        },
        requestedBy: requester,
      });
      toast.success("Status change submitted for approval.");
      setProposeOpen(false);
      setProposeRow(null);
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to submit change request.");
    } finally {
      setProposeSubmitting(false);
    }
  };

  const columns = [
    { key: "id", label: "Queue ID", sortable: true },
    { key: "sessionId", label: "Session ID", sortable: true },
    {
      key: "dateTime",
      label: "Date",
      sortable: true,
      render: (value) => formatBackendDateTime(value),
    },
    { key: "sourceAccountName", label: "From" },
    { key: "beneficiaryAccountName", label: "To" },
    { key: "amount", label: "Amount", render: (value) => `₦${Number(value || 0).toLocaleString()}` },
    { key: "status", label: "Status", render: (value, row) => <StatusBadge status={row.status} /> },
  ];

  const actions = (row) => (
    <div className="flex gap-2 flex-wrap items-center">
      {canSubmit && !row.approvedBy && (
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openPropose(row)}>
          Request status change
        </Button>
      )}
      {canApprove && (
        <span className="text-sm text-gray-500">
          Approve in{" "}
          <Link to="/approvals/change-requests" className="text-primary underline font-medium">
            Change requests
          </Link>
        </span>
      )}
      {!canSubmit && !canApprove && !row.approvedBy && (
        <span className="text-sm text-gray-500">Awaiting approval</span>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Transaction Status</h1>
        <Button variant="outline" onClick={loadItems} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-gray-500 text-sm">
        {canApprove && !canSubmit
          ? "Operators submit transaction status changes; approve or reject those requests in Change requests."
          : canSubmit
            ? "Submit a proposed final status for pending items. An approver applies it from Change requests."
            : "You do not have permission to submit or approve transaction status changes."}
      </p>
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      <DataTable
        data={items}
        columns={columns}
        selectable
        actions={actions}
        isLoading={isLoading}
        emptyMessage="No account transaction approval items were returned by the backend."
      />

      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request status change</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Session: <strong>{proposeRow?.sessionId || "—"}</strong>
            </p>
            <div className="space-y-2">
              <Label>Proposed status</Label>
              <Select value={proposeTarget} onValueChange={setProposeTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Successful">Successful</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-reason">Reason / note</Label>
              <Input
                id="tx-reason"
                value={proposeReason}
                onChange={(e) => setProposeReason(e.target.value)}
                placeholder="Shown to approvers"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProposeOpen(false)} disabled={proposeSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={submitProposedStatus} disabled={proposeSubmitting} className="gap-2">
              {proposeSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Submit for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
