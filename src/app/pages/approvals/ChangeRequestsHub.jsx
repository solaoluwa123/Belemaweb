import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Loader2, RefreshCcw, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  CHANGE_RESOURCE_TYPES,
  approveChangeRequest,
  fetchChangeRequests,
  rejectChangeRequest,
} from "../../services/changeRequests";
import { requestTransactionStatusChange } from "../../services/transactions";
import { formatBackendDateTime } from "../../utils/formatters";

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800";
  if (s === "rejected") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-900";
}

export default function ChangeRequestsHub() {
  const { user, isApprover, isOperator, isAdmin } = useAuth();
  const approver = isApprover();
  const operator = isOperator();
  const admin = isAdmin();
  const identity = String(user?.username || user?.email || "").trim();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const showQueue = approver || admin;
  const showMine = operator;
  const [tab, setTab] = useState(showQueue ? "queue" : "mine");

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteAction, setNoteAction] = useState("approve");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchChangeRequests({});
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof APIError ? e.message : "Unable to load change requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingAll = useMemo(() => items.filter((r) => String(r.status) === "Pending"), [items]);
  const mineAll = useMemo(
    () =>
      identity
        ? items.filter((r) => String(r.requestedBy || "").toLowerCase() === identity.toLowerCase())
        : [],
    [items, identity]
  );

  const openAction = (row, action) => {
    setSelected(row);
    setNoteAction(action);
    setNote("");
    setNoteOpen(true);
  };

  const confirmAction = async () => {
    if (!selected || !identity) return;
    setActing(true);
    try {
      if (noteAction === "approve") {
        try {
          await approveChangeRequest({ id: selected.id, approvedBy: identity, note, row: selected });
        } catch (approveErr) {
          // Some backend deployments apply the approval but return a non-2xx response.
          // If the row is no longer in the queue after refresh, treat as success.
          const refreshed = await fetchChangeRequests({});
          setItems(Array.isArray(refreshed) ? refreshed : []);
          const selectedKey = selected.rowKey || `${selected.resourceType}:${selected.id}`;
          const stillPending = (refreshed || []).some(
            (item) => (item.rowKey || `${item.resourceType}:${item.id}`) === selectedKey,
          );
          if (stillPending) {
            throw approveErr;
          }
        }
        if (selected.resourceType === CHANGE_RESOURCE_TYPES.TRANSACTION_STATUS_DECISION) {
          const p = selected.payload && typeof selected.payload === "object" ? selected.payload : {};
          const sessionId = String(p.sessionId || "").trim();
          const newStatus = String(p.targetStatus || "").trim();
          const reason = String(p.reason || note || "").trim() || "Approved via change request";
          if (sessionId && newStatus) {
            try {
              await requestTransactionStatusChange({ transactionId: sessionId, newStatus, reason });
            } catch (syncErr) {
              toast.warning(
                syncErr instanceof APIError
                  ? `Approved, but status API failed: ${syncErr.message}`
                  : "Approved, but the transaction status API call failed."
              );
              setNoteOpen(false);
              setSelected(null);
              await load();
              return;
            }
          }
        }
        toast.success("Change approved and applied.");
      } else {
        await rejectChangeRequest({ id: selected.id, reviewedBy: identity, note, row: selected });
        toast.success("Change request rejected.");
      }
      setNoteOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Action failed.");
    } finally {
      setActing(false);
    }
  };

  if (!approver && !operator && !admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-1 h-8 w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Change requests</h1>
            <p className="text-sm text-slate-600">
              {approver
                ? "Review and approve or reject submissions from operators and administrators."
                : admin
                  ? "View all submitted change requests (read-only)."
                : "Track requests you submitted for approver review."}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`grid w-full max-w-lg ${showQueue && showMine ? "grid-cols-2" : "grid-cols-1"}`}>
          {showQueue ? <TabsTrigger value="queue">Pending review ({pendingAll.length})</TabsTrigger> : null}
          {showMine ? <TabsTrigger value="mine">My submissions ({mineAll.length})</TabsTrigger> : null}
        </TabsList>

        {showQueue ? (
          <TabsContent value="queue" className="mt-4">
            <RequestTable
              rows={pendingAll}
              loading={loading}
              mode={approver ? "approve" : "mine"}
              onApprove={(r) => openAction(r, "approve")}
              onReject={(r) => openAction(r, "reject")}
            />
          </TabsContent>
        ) : null}

        {showMine ? (
          <TabsContent value="mine" className="mt-4">
            <RequestTable rows={mineAll} loading={loading} mode="mine" />
          </TabsContent>
        ) : null}
      </Tabs>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            Create, edit, and delete actions for wallets, disputes, and system users are stored as pending change
            requests. An <strong>Approver</strong> must approve them before they take effect. You cannot approve your
            own request.
          </p>
        </CardContent>
      </Card>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{noteAction === "approve" ? "Approve change" : "Reject change"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{selected?.summary}</span>
              <span className="block font-mono text-xs text-slate-500 mt-1">{selected?.resourceType}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cr-note">Note (optional)</Label>
              <Input
                id="cr-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Comment for audit trail"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)} disabled={acting}>
              Cancel
            </Button>
            <Button
              type="button"
              className={noteAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              variant={noteAction === "approve" ? "default" : "destructive"}
              onClick={confirmAction}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {noteAction === "approve" ? "Approve & apply" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestTable({ rows, loading, mode, onApprove, onReject }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 py-14 text-center text-sm text-slate-600">
        No change requests to show.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-center text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-center">
            <th className="p-3 font-semibold text-slate-900">ID</th>
            <th className="p-3 font-semibold text-slate-900">Summary</th>
            <th className="p-3 font-semibold text-slate-900">Type</th>
            <th className="p-3 font-semibold text-slate-900">Requested by</th>
            <th className="p-3 font-semibold text-slate-900">Status</th>
            <th className="p-3 font-semibold text-slate-900">When</th>
            {mode === "approve" ? <th className="p-3 font-semibold text-slate-900">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowKey || r.id} className="border-b border-slate-100 text-center hover:bg-slate-50/80">
              <td className="p-3 font-mono text-xs">{r.id}</td>
              <td className="p-3 max-w-[220px] truncate" title={r.summary}>
                {r.summary}
              </td>
              <td className="p-3 font-mono text-xs text-slate-700">{r.resourceType}</td>
              <td className="p-3">{r.requestedBy}</td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                  {r.status}
                </span>
              </td>
              <td className="p-3 whitespace-nowrap text-slate-600">
                {formatBackendDateTime(r.createdAt)}
              </td>
              {mode === "approve" ? (
                <td className="p-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(r)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="gap-1 text-rose-700 border-rose-200" onClick={() => onReject(r)}>
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
