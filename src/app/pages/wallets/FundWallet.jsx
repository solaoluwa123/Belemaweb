import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { fetchFundingRequests, fetchWallets, submitFundingRequest } from "../../services/wallets";

function formatMoney(n) {
  return `NGN ${Number(n ?? 0).toLocaleString()}`;
}

export default function FundWallet() {
  const navigate = useNavigate();
  const { user, isOperator, isApprover, isAdmin } = useAuth();
  const admin = isAdmin();
  const canInitiateFunding = isOperator() || admin;
  const canReviewFunding = isApprover() || admin;
  const username = user?.username || user?.email || "";

  const tabTriggers = [
    canInitiateFunding ? "initiate" : null,
    canReviewFunding ? "queue" : null,
    canInitiateFunding ? "mine" : null,
  ].filter(Boolean);
  const tabsListClass =
    tabTriggers.length >= 3
      ? "grid w-full grid-cols-3"
      : tabTriggers.length === 2
        ? "grid w-full grid-cols-2"
        : "grid w-full grid-cols-1";

  const [wallets, setWallets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [w, r] = await Promise.all([fetchWallets(), fetchFundingRequests()]);
      setWallets(w);
      setRequests(r);
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Unable to load funding data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pendingForOthers = requests.filter(
    (r) => r.status === "Pending" && username && String(r.requestedBy).toLowerCase() !== String(username).toLowerCase()
  );
  const myRequests = requests.filter(
    (r) => username && String(r.requestedBy).toLowerCase() === String(username).toLowerCase()
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletId || !amount || !username) {
      setError("Select a wallet, amount, and ensure you are signed in.");
      return;
    }
    const wallet = wallets.find((w) => String(w.id) === String(walletId));
    if (!wallet) {
      setError("Selected wallet is no longer available. Refresh and try again.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await submitFundingRequest({
        wallet,
        amount,
        narration,
        requestedBy: username,
        type: "credit",
      });
      if (admin) {
        setSuccess("Funding applied immediately. Wallet balance has been updated.");
      } else {
        setSuccess("Funding request submitted. Another user must approve it before funds are applied.");
      }
      setAmount("");
      setNarration("");
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const defaultTab = canReviewFunding && !canInitiateFunding ? "queue" : "initiate";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fund wallet</h1>
        <p className="text-gray-500 mt-1">
          {admin
            ? "Admin funding is applied immediately. Operator requests still require approval."
            : "Maker–checker: you initiate funding; a different admin or approver approves or rejects."}
        </p>
      </div>

      {!admin ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Anti-fraud control</p>
            <p className="mt-1 text-amber-900/90">
              The same user cannot approve or reject a request they created. Use another account (e.g. approver vs operator) to
              complete the workflow.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={tabsListClass}>
          {canInitiateFunding && <TabsTrigger value="initiate">{admin ? "Fund now" : "New request"}</TabsTrigger>}
          {canReviewFunding && <TabsTrigger value="queue">Approval queue</TabsTrigger>}
          {canInitiateFunding && <TabsTrigger value="mine">My requests</TabsTrigger>}
        </TabsList>

        {canInitiateFunding && (
        <TabsContent value="initiate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{admin ? "Apply funding" : "Funding request"}</CardTitle>
              <CardDescription>
                {admin
                  ? "Credits the wallet balance immediately — no approval queue."
                  : "Creates a pending request — no balance change until approved by someone else."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading wallets…
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>Wallet *</Label>
                    <Select value={walletId} onValueChange={setWalletId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet to fund" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.accountNumber} — {w.accountName} ({formatMoney(w.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fw-amount">Amount (NGN) *</Label>
                    <Input
                      id="fw-amount"
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fw-narration">Narration</Label>
                    <Input id="fw-narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Logged in as <strong>{username || "—"}</strong>
                    {admin ? " (admin — funds apply immediately)." : " (recorded as maker)."}
                  </div>
                  <Button type="submit" disabled={submitting || !username}>
                    {submitting ? "Submitting…" : admin ? "Apply funding" : "Submit funding request"}
                  </Button>
                </form>
              )}
                       </CardContent>
          </Card>
        </TabsContent>
        )}

        {canReviewFunding && (
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval queue</CardTitle>
              <CardDescription>Pending operator funding requests you did not create — open one to approve or reject.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : pendingForOthers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests from other users.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {pendingForOthers.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {formatMoney(r.amount)} → {r.accountName || r.walletNumber || r.walletId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested by {r.requestedBy} · {r.id}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/wallets/fund/review/${encodeURIComponent(r.id)}`)}>
                        Review
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {canInitiateFunding && (
        <TabsContent value="mine" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>My requests</CardTitle>
              <CardDescription>
                {admin
                  ? "Admin funding is applied immediately, so pending rows are uncommon here."
                  : "Track status of funding you initiated."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">You have not submitted any pending requests yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {myRequests.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {formatMoney(r.amount)} · <span className="capitalize">{r.status}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{r.id}</p>
                      </div>
                      {r.status === "Pending" ? (
                        <span className="text-xs text-muted-foreground">Awaiting another user&apos;s review</span>
                      ) : (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/wallets/fund/review/${encodeURIComponent(r.id)}`}>View outcome</Link>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      <p className="text-sm text-muted-foreground">
        Wallet balances and registry are managed under{" "}
        <Link to="/wallets" className="text-primary underline-offset-2 hover:underline">
          View wallets
        </Link>
        .
      </p>
    </div>
  );
}
