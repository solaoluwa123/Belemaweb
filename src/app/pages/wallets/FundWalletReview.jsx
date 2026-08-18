import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { CheckCircle2, Loader2, ArrowLeft, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { approveFundingRequest, fetchFundingRequests, rejectFundingRequest } from "../../services/wallets";
import { formatBackendDateTime } from "../../utils/formatters";

export default function FundWalletReview() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user, isApprover, isAdmin } = useAuth();
  const username = user?.username || user?.email || "";

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Banner shown after a successful approve / reject. `kind` controls the colour
  // (emerald for approve, rose for reject) so the user can distinguish at a glance.
  const [resultBanner, setResultBanner] = useState(null); // { kind: 'approve'|'reject', text: string }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchFundingRequests();
      const found = list.find((r) => r.id === requestId);
      setReq(found || null);
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Unable to load request.");
      setReq(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResultBanner(null);
    load();
  }, [requestId]);

  const isMaker = req && username && String(req.requestedBy).toLowerCase() === String(username).toLowerCase();
  const canAct = (isApprover() || isAdmin()) && req?.status === "Pending" && !isMaker;

  const handleApprove = async () => {
    if (!req || !username) return;
    setBusy(true);
    setError("");
    setResultBanner(null);
    const opLabel = req.actionType === "debit" ? "debit" : "credit";
    const amountLabel = `NGN ${Number(req.amount || 0).toLocaleString()}`;
    try {
      await approveFundingRequest({
        row: req,
        id: req.id,
        approvedBy: username,
        actionType: req.actionType,
        note,
      });
      const text = `Funding request #${req.id} approved — ${amountLabel} ${opLabel} on wallet ${req.walletNumber} will be applied by the backend.`;
      setResultBanner({ kind: "approve", text });
      toast.success(`Funding request #${req.id} approved.`, {
        description: `${amountLabel} ${opLabel} on wallet ${req.walletNumber}.`,
      });
      await load();
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  };

  // Backend `PUT /wallets/reject-funding` (see `rejectFundingRequest`). The helper
  // also mirrors the rejection locally so anything depending on the dismissed/undo
  // flow keeps working until the next refresh removes the row from the backend list.
  const handleReject = async () => {
    if (!req || !username) return;
    setBusy(true);
    setError("");
    setResultBanner(null);
    const opLabel = req.actionType === "debit" ? "debit" : "credit";
    const amountLabel = `NGN ${Number(req.amount || 0).toLocaleString()}`;
    try {
      await rejectFundingRequest({
        row: req,
        id: req.id,
        reviewedBy: username,
        actionType: req.actionType,
        note,
      });
      const text = `Funding request #${req.id} rejected — ${amountLabel} ${opLabel} on wallet ${req.walletNumber} will not be applied.`;
      setResultBanner({ kind: "reject", text });
      toast.error(`Funding request #${req.id} rejected.`, {
        description: `${amountLabel} ${opLabel} on wallet ${req.walletNumber}.`,
      });
      await load();
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Rejection failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" className="gap-2 pl-0" onClick={() => navigate("/wallets/fund")}>
        <ArrowLeft className="w-4 h-4" />
        Back to fund wallet
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Review funding request</h1>
        <p className="text-gray-500 mt-1">Reference: {requestId}</p>
      </div>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {resultBanner ? (
        resultBanner.kind === "reject" ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{resultBanner.text}</span>
          </div>
        ) : (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{resultBanner.text}</span>
          </div>
        )
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : !req ? (
        <p className="text-sm text-muted-foreground">Request not found.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{req.status === "Pending" ? "Pending approval" : req.status}</CardTitle>
            <CardDescription>
              Requested by <strong>{req.requestedBy}</strong>
              {req.status !== "Pending" && req.reviewedBy ? (
                <>
                  {" "}
                  · Reviewed by <strong>{req.reviewedBy}</strong>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Wallet</dt>
                <dd className="font-medium">
                  {req.walletNumber} — {req.accountName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium">NGN {Number(req.amount).toLocaleString()}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Narration</dt>
                <dd>{req.narration || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatBackendDateTime(req.createdAt)}</dd>
              </div>
              {req.reviewedAt ? (
                <div>
                  <dt className="text-muted-foreground">Reviewed</dt>
                  <dd>{formatBackendDateTime(req.reviewedAt)}</dd>
                </div>
              ) : null}
            </dl>

            {req.reviewNote ? (
              <div>
                <Label>Review note</Label>
                <p className="mt-1 text-sm rounded-md border bg-muted/40 p-3">{req.reviewNote}</p>
              </div>
            ) : null}

            {req.status === "Pending" && isMaker ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                You created this request. Another user must open this screen from the <strong>Approval queue</strong> tab to
                approve or reject it.
              </div>
            ) : null}

            {canAct ? (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="rev-note">Note (optional)</Label>
                  <Textarea id="rev-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleApprove} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                    {busy ? "Working…" : "Approve"}
                  </Button>
                  <Button variant="destructive" onClick={handleReject} disabled={busy}>
                    {busy ? "Working…" : "Reject"}
                  </Button>
                </div>
              </div>
            ) : null}

            {req.status !== "Pending" ? (
              <Button variant="outline" asChild>
                <Link to="/wallets/fund">Return to fund wallet</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
