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
import { CheckCircle, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  approveInstitutionApproval,
  fetchInstitutionApprovals,
  fetchInstitutionsActionsDirectory,
  rejectInstitutionApproval,
} from "../../services/approvals";
import { toast } from "sonner";
import { formatBackendDateTime } from "../../utils/formatters";

export default function InstitutionApprovals() {
  const { user, isApprover, isOperator, isAdmin } = useAuth();
  // Admins, approvers, and operators can all act on pending institution registrations.
  // The backend (`/financial-institutions/approval`, `/financial-institutions/reject/{id}`)
  // validates the caller's role server-side, so this gate is just a UX safeguard.
  const canAct = isAdmin() || isApprover() || isOperator();
  const requester = String(user?.username || user?.email || "").trim();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionsMeta, setActionsMeta] = useState(null);

  const loadApprovals = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setItems(await fetchInstitutionApprovals());
    } catch (error) {
      setItems([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load institution approvals.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dir = await fetchInstitutionsActionsDirectory();
        if (!cancelled) setActionsMeta(dir && typeof dir === "object" ? dir : null);
      } catch {
        if (!cancelled) setActionsMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Both operator and approver paths converge to the same backend endpoints
  // (`/financial-institutions/approval` and `/financial-institutions/reject/{id}`).
  // The previous version routed operators through `submitChangeRequest`, but that
  // helper just forwards to the same endpoints, so we call them directly here for a
  // simpler UX with consistent error/success handling.
  // Busy-state key and approval API id are the pending `tbl_nodes_pendings.id`.
  const resolveId = (row) => String(row?.raw?.id ?? row?.id ?? "").trim();
  const resolveCode = (row) =>
    String(row?.raw?.code ?? row?.raw?.institutionCode ?? "").trim();

  const handleApprove = async (row) => {
    if (!requester) {
      toast.error("Missing user identity.");
      return;
    }
    const id = resolveId(row);
    const code = resolveCode(row);
    if (!id) {
      toast.error("Institution approval id is missing from this row.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setPendingId(id);
    try {
      await approveInstitutionApproval(row, requester);
      setSuccessMessage(`Institution ${code || id} approved.`);
      toast.success(`Institution ${code || id} approved.`);
      await loadApprovals();
    } catch (error) {
      const msg = error instanceof APIError ? error.message : "Unable to approve institution.";
      setErrorMessage(msg);
      toast.error(msg);
      // A 404 from `/financial-institutions/approval` means the pending row no longer
      // exists (already actioned or never a pending submission). Refresh the queue so
      // the stale row disappears.
      if (error instanceof APIError && error.status === 404) {
        await loadApprovals();
      }
    } finally {
      setPendingId(null);
    }
  };

  const openRejectDialog = (row) => {
    setRejectTarget(row);
    setRejectReason("");
  };

  const closeRejectDialog = () => {
    if (pendingId) return;
    setRejectTarget(null);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const id = resolveId(rejectTarget);
    const code = resolveCode(rejectTarget);
    if (!id) {
      toast.error("Institution approval id is missing from this row.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setPendingId(id);
    try {
      await rejectInstitutionApproval(rejectTarget, requester);
      setSuccessMessage(`Institution ${code || id} rejected.`);
      toast.success(`Institution ${code || id} rejected.`, {
        description: rejectReason.trim()
          ? `Reason recorded locally: ${rejectReason.trim()}`
          : undefined,
      });
      setRejectTarget(null);
      setRejectReason("");
      await loadApprovals();
    } catch (error) {
      const msg = error instanceof APIError ? error.message : "Unable to reject institution.";
      setErrorMessage(msg);
      toast.error(msg);
      if (error instanceof APIError && error.status === 404) {
        await loadApprovals();
      }
    } finally {
      setPendingId(null);
    }
  };

  const columns = [
    { key: "id", label: "Approval ID", sortable: true },
    {
      key: "submittedBy",
      label: "Submitted By",
      render: (value) => (value && String(value).trim() ? String(value) : "—"),
    },
    {
      key: "submittedDate",
      label: "Date",
      sortable: true,
      render: (value) => formatBackendDateTime(value),
    },
    { key: "details", label: "Institution Details" },
    { key: "status", label: "Status", render: (_value, row) => <StatusBadge status={row.status || "Pending"} /> },
  ];

  const actions = (row) => {
    const id = resolveId(row);
    const isThisRowBusy = pendingId && id && pendingId === id;
    if (!canAct) {
      return <span className="text-sm text-gray-500">View only</span>;
    }
    // Always render clickable icons for users with permission. The endpoints
    // (`PUT /financial-institutions/approval` and `PUT /financial-institutions/reject`)
    // enforce the actual approval state server-side, so we let the user click and
    // surface any backend rejection as a toast.
    return (
      <div className="flex gap-1 items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-emerald-600 hover:bg-emerald-50"
          onClick={() => handleApprove(row)}
          disabled={Boolean(pendingId)}
          aria-label="Approve"
          title="Approve this institution"
        >
          {isThisRowBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => openRejectDialog(row)}
          disabled={Boolean(pendingId)}
          aria-label="Reject"
          title="Reject this institution"
        >
          <XCircle className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Institution Approvals</h1>
        <Button variant="outline" onClick={loadApprovals} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-gray-500 text-sm">
        {canAct
          ? "Approve or reject pending institution registrations."
          : "You do not have access to approve or reject institution registrations."}
        {actionsMeta &&
        (actionsMeta.institutionTypes?.length || actionsMeta.institutions?.length) ? (
          <span className="block mt-1 text-xs text-slate-500">
            Directory from <code className="rounded bg-slate-100 px-1">GET /financial-institutions/get/actions</code>:{" "}
            {[
              actionsMeta.institutionTypes?.length ? `${actionsMeta.institutionTypes.length} type(s)` : null,
              actionsMeta.institutions?.length ? `${actionsMeta.institutions.length} institution(s)` : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </span>
        ) : null}
      </p>
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
        emptyMessage="No institution approvals returned by the backend."
      />

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => (!open ? closeRejectDialog() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject institution</DialogTitle>
            <DialogDescription>
              The backend records the rejection but does not store a reason. Anything you type here is
              kept only for your own records (shown in the success toast).
            </DialogDescription>
          </DialogHeader>
          {rejectTarget ? (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-900">{rejectTarget.details || "Institution"}</p>
                <p className="text-xs text-slate-500">
                  Code #{resolveId(rejectTarget)} · Submitted by {rejectTarget.submittedBy || "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="institution-reject-reason">Reason (optional)</Label>
                <Input
                  id="institution-reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. invalid documents, duplicate registration"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeRejectDialog} disabled={Boolean(pendingId)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              disabled={Boolean(pendingId) || !rejectTarget}
            >
              {pendingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
