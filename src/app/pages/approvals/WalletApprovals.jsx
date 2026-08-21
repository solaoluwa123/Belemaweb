import { useEffect, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { CheckCircle, Eye, EyeOff, Loader2, RefreshCcw, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  approveWalletApproval,
  clearDismissedWalletApprovals,
  dismissWalletApproval,
  fetchWalletApprovals,
  rejectWalletApprovalLocally,
  restoreWalletApproval,
} from "../../services/approvals";
import { formatBackendDateTime } from "../../utils/formatters";

export default function WalletApprovals() {
  const { user, isApprover, isAdmin } = useAuth();
  const canApprove = isApprover() || isAdmin();
  const [activeRows, setActiveRows] = useState([]);
  const [dismissedRows, setDismissedRows] = useState([]);
  const [view, setView] = useState("active"); // "active" | "dismissed"
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const loadApprovals = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [active, dismissed] = await Promise.all([
        fetchWalletApprovals(),
        fetchWalletApprovals({ onlyDismissed: true }),
      ]);
      setActiveRows(active);
      setDismissedRows(dismissed);
    } catch (error) {
      setActiveRows([]);
      setDismissedRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load wallet approvals.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const items = view === "dismissed" ? dismissedRows : activeRows;

  const buildApprovalErrorMessage = (row, error) => {
    const fromApi =
      error instanceof APIError ? String(error.message || "").trim() : "";
    const isGeneric500 =
      error instanceof APIError &&
      error.status === 500 &&
      /unknown error/i.test(fromApi);
    if (isGeneric500) {
      return `The backend rejected wallet operation ${row.id} with a generic 500 ("Unknown error has occured"). This typically means the request row contains data the server cannot apply (often an invalid wallettype FK). Ask the backend team to inspect the row in tbl_wallets_operations, or use Dismiss to remove it from your queue.`;
    }
    return fromApi || "Unable to approve the wallet request.";
  };

  const handleApprove = async (row) => {
    setErrorMessage("");
    setSuccessMessage("");
    const creator = String(user?.username || user?.email || "").trim();
    const actionType = row.raw?.actionType ?? row.raw?.actiontype;
    try {
      await approveWalletApproval({
        id: row.id,
        actionType,
        creator,
      });
      setSuccessMessage(`Wallet operation ${row.id} approved successfully.`);
      await loadApprovals();
    } catch (error) {
      // Backend now performs the target write (INSERT/UPDATE on tbl_wallets) BEFORE
      // deleting the pending row, so a non-2xx response means the row is genuinely
      // still pending and the user can retry. Surface the real error and refresh
      // the queue so the row remains visible.
      setErrorMessage(buildApprovalErrorMessage(row, error));
      try {
        await loadApprovals();
      } catch {
        // Ignore refresh failure; the error message already explains what happened.
      }
    }
  };

  const handleDismiss = (row) => {
    dismissWalletApproval(row.id);
    setActiveRows((current) => current.filter((item) => String(item.id) !== String(row.id)));
    setDismissedRows((current) => {
      if (current.some((item) => String(item.id) === String(row.id))) return current;
      return [...current, { ...row, dismissed: true }];
    });
    setErrorMessage("");
    toast.success(`Wallet operation ${row.id} hidden from your queue.`, {
      action: {
        label: "Undo",
        onClick: () => handleRestore(row),
      },
    });
  };

  const handleRestore = (row) => {
    restoreWalletApproval(row.id);
    setDismissedRows((current) => current.filter((item) => String(item.id) !== String(row.id)));
    setActiveRows((current) => {
      if (current.some((item) => String(item.id) === String(row.id))) return current;
      return [...current, { ...row, dismissed: false }];
    });
    toast.success(`Wallet operation ${row.id} restored to your queue.`);
  };

  const handleClearDismissed = () => {
    if (!dismissedRows.length) return;
    clearDismissedWalletApprovals();
    toast.success(`Restored ${dismissedRows.length} dismissed row(s).`);
    loadApprovals();
  };

  const openRejectDialog = (row) => {
    setRejectTarget(row);
    setRejectReason("");
  };

  const closeRejectDialog = () => {
    if (isRejecting) return;
    setRejectTarget(null);
    setRejectReason("");
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const reviewedBy = String(user?.username || user?.email || "").trim();
    setIsRejecting(true);
    try {
      rejectWalletApprovalLocally({
        id: rejectTarget.id,
        reason: rejectReason,
        reviewedBy,
      });
      // Move to dismissed list locally with the new decision metadata.
      const decided = {
        ...rejectTarget,
        dismissed: true,
        decision: {
          kind: "rejected",
          reason: rejectReason.trim(),
          decidedBy: reviewedBy,
          decidedAt: new Date().toISOString(),
        },
      };
      setActiveRows((current) => current.filter((item) => String(item.id) !== String(rejectTarget.id)));
      setDismissedRows((current) => {
        const without = current.filter((item) => String(item.id) !== String(rejectTarget.id));
        return [...without, decided];
      });
      toast.success(`Wallet operation ${rejectTarget.id} rejected.`, {
        description: "Backend reject path is not implemented; this is a local rejection and is reversible from the Dismissed view.",
        action: {
          label: "Undo",
          onClick: () => handleRestore(rejectTarget),
        },
      });
      setRejectTarget(null);
      setRejectReason("");
    } finally {
      setIsRejecting(false);
    }
  };

  const renderStatus = (_value, row) => {
    if (view === "dismissed" && row.decision) {
      const isReject = row.decision.kind === "rejected";
      return (
        <div className="space-y-0.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isReject ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {isReject ? "Rejected" : "Dismissed"}
          </span>
          {isReject && row.decision.reason ? (
            <p className="text-xs text-slate-500" title={row.decision.reason}>
              Reason: {row.decision.reason}
            </p>
          ) : null}
          {row.decision.decidedBy ? (
            <p className="text-[11px] text-slate-400">By {row.decision.decidedBy}</p>
          ) : null}
        </div>
      );
    }
    return <StatusBadge status={row.status} />;
  };

  const columns = [
    { key: "id", label: "Approval ID", sortable: true },
    { key: "submittedBy", label: "Submitted By" },
    { key: "submittedDate", label: "Date", sortable: true, render: (value) => formatBackendDateTime(value) },
    { key: "details", label: "Wallet Details" },
    { key: "status", label: "Status", render: renderStatus },
  ];

  const actions = (row) => {
    if (view === "dismissed") {
      return (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-blue-600 hover:bg-blue-50"
            onClick={() => handleRestore(row)}
            aria-label="Restore"
            title="Restore this row to the active queue"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      );
    }
    return (
      <div className="flex gap-2">
        {row.status === "Pending" && canApprove && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="text-emerald-600 hover:bg-emerald-50"
              onClick={() => handleApprove(row)}
              aria-label="Approve"
              title="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-rose-600 hover:bg-rose-50"
              onClick={() => openRejectDialog(row)}
              aria-label="Reject"
              title="Reject this wallet creation request"
            >
              <XCircle className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:bg-slate-100"
              onClick={() => handleDismiss(row)}
              aria-label="Dismiss"
              title="Hide this row from your queue (for stuck rows the backend cannot process)"
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          </>
        )}
        {row.status === "Pending" && !canApprove && (
          <span className="text-sm text-gray-500">Awaiting approval</span>
        )}
      </div>
    );
  };

  const emptyMessage =
    view === "dismissed"
      ? "No dismissed rows. Use the Dismiss icon on a row to hide it here."
      : "No wallet approvals returned by the backend.";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Wallet Approvals</h1>
        <Button variant="outline" onClick={loadApprovals} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-gray-500 text-sm">
        {canApprove ? "Approve or reject wallet requests from operators." : "Wallet requests you submitted are listed below."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={view === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("active")}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Active ({activeRows.length})
        </Button>
        <Button
          type="button"
          variant={view === "dismissed" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("dismissed")}
          className="gap-2"
          disabled={dismissedRows.length === 0 && view !== "dismissed"}
        >
          <EyeOff className="w-4 h-4" />
          Dismissed ({dismissedRows.length})
        </Button>
        {view === "dismissed" && dismissedRows.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearDismissed}
            className="gap-2 text-slate-600"
            title="Restore all dismissed rows"
          >
            <RotateCcw className="w-4 h-4" />
            Restore all
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}
      <DataTable
        data={items}
        columns={columns}
        selectable
        actions={actions}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => (!open ? closeRejectDialog() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject wallet request</DialogTitle>
            <DialogDescription>
              The backend has no reject endpoint for wallet operations yet, so this rejection is recorded
              locally for your session and is reversible from the Dismissed view.
            </DialogDescription>
          </DialogHeader>
          {rejectTarget ? (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-900">{rejectTarget.details}</p>
                <p className="text-xs text-slate-500">
                  Approval ID #{rejectTarget.id} · Submitted by {rejectTarget.submittedBy || "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wallet-reject-reason">Reason (optional)</Label>
                <Input
                  id="wallet-reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. invalid wallet type, duplicate request"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeRejectDialog} disabled={isRejecting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              disabled={isRejecting || !rejectTarget}
            >
              {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
