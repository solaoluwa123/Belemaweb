import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
import { Download, ArrowLeft, Loader2, RefreshCcw, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { fetchTransactionDetails, requestTransactionStatusChange } from "../../services/transactions";
import { toast } from "sonner";
import { parseBackendDate, getBackendDateTime, formatBackendDateTime } from "../../utils/formatters";

function formatDateTime(value) {
  return formatBackendDateTime(value, { fallback: "–" });
}

/** Matches TransactionList card-style timestamps. */
function formatCardDateTime(value) {
  if (value == null || value === "" || value === "undefined" || value === "null") return "–";
  const d = parseBackendDate(value);
  if (!d) return "–";
  return d
    .toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function displayField(value) {
  if (value == null || value === "" || value === "undefined" || value === "null") return "–";
  return String(value);
}

function formatDurationSecs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "–";
  return `${Math.round(n / 1000)} secs`;
}

function transactionDurationMs(t) {
  const fromApi = Number(t?.ftDurationMs);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
  const a = getBackendDateTime(t?.requestTime);
  const b = getBackendDateTime(t?.responseTime);
  if (a && b && b >= a) return b - a;
  return NaN;
}

function formatStatusLabel(row) {
  const msg = String(row?.responseMessage || "").trim();
  const code = String(row?.responseCode || "").trim();
  const status = String(row?.status || "").trim();
  if (msg && code) return `${msg} - ${code}`;
  if (msg) return msg;
  if (status && code) return `${status} - ${code}`;
  return status || "–";
}

function formatAmount(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatReversed(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "–";
  if (s === "yes" || s === "true" || s === "1") return "Yes";
  if (s === "no" || s === "false" || s === "0") return "No";
  return value;
}

export default function TransactionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOperator, canRequestStatusChange, user, requiresInstitutionScope } = useAuth();
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState("Successful");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const loadTransaction = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchTransactionDetails(id);
      if (data && requiresInstitutionScope()) {
        const mine = String(user?.institutionCode || "").trim();
        const src = String(data.sourceInstitutionCode || "").trim();
        const dest = String(data.destinationInstitutionCode || "").trim();
        if (!mine) {
          setTransaction(null);
          setErrorMessage("Your account is not linked to an institution.");
          return;
        }
        if (src !== mine && dest !== mine) {
          setTransaction(null);
          setErrorMessage("This transaction is not linked to your institution.");
          return;
        }
      }
      setTransaction(data);
      if (!data) {
        setErrorMessage("Transaction details were not found.");
      }
    } catch (error) {
      const message =
        error instanceof APIError && error.status === 401
          ? "Your session is not authorized to view this transaction."
          : error instanceof APIError
            ? error.message
            : "Unable to load the transaction details.";
      setTransaction(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const timelineItems = useMemo(() => {
    if (!transaction) return [];

    const responseAt = transaction.responseTime || transaction.dateTime;
    const requestAt = transaction.requestTime || transaction.dateTime;

    return [
      {
        label: "Last Updated",
        date: transaction.timelineDate || responseAt,
        tone: "bg-green-600",
      },
      {
        label: "Response Received",
        date: responseAt,
        tone: "bg-blue-600",
      },
      {
        label: "Request Sent",
        date: requestAt,
        tone: "bg-gray-400",
      },
    ].filter((item) => item.date);
  }, [transaction]);

  const handleDownloadReceipt = () => {
    if (!transaction) return;

    const durMs = transactionDurationMs(transaction);
    const content = [
      "Transaction Receipt",
      "-------------------",
      `MTI: ${transaction.mti || "–"}`,
      `Masked PAN: ${transaction.maskedPan || "–"}`,
      `STAN: ${transaction.stan || "–"}`,
      `RRN: ${transaction.rrn || "–"}`,
      `Terminal ID: ${transaction.terminalId || "–"}`,
      `Request Time: ${formatCardDateTime(transaction.requestTime) || "–"}`,
      `Response Time: ${formatCardDateTime(transaction.responseTime) || "–"}`,
      `Duration: ${formatDurationSecs(durMs)}`,
      `Merchant ID: ${transaction.merchantId || "–"}`,
      `Location: ${transaction.locationNameAddress || "–"}`,
      `Transaction Status: ${formatStatusLabel(transaction)}`,
      `Processing Code: ${transaction.processingCode || "–"}`,
      `ACQ ID: ${transaction.acqId || "–"}`,
      `DEST ACQ ID: ${transaction.destAcqId || "–"}`,
      `Approval Code: ${transaction.approvalCode || "–"}`,
      `Contact number: ${transaction.contactNumber || transaction.cardHolderNumber || "–"}`,
      `Reversed: ${formatReversed(transaction.reversed)}`,
      `UUID: ${transaction.uuid || "–"}`,
      "---",
      `Session ID: ${transaction.sessionId || transaction.id}`,
      `Payment Reference: ${transaction.paymentReferenceNo || "–"}`,
      `Amount: ${formatAmount(transaction.amount)}`,
      `Status: ${transaction.status}`,
      `Source Account: ${transaction.sourceAccountNumber || "–"} (${transaction.sourceAccountName || "–"})`,
      `Source Bank: ${transaction.sourceBank || "–"}`,
      `Beneficiary Account: ${transaction.beneficiaryAccountNumber || "–"} (${transaction.beneficiaryAccountName || "–"})`,
      `Beneficiary Bank: ${transaction.beneficiaryBank || "–"}`,
      `Response Code: ${transaction.responseCode || "–"}`,
      `Response Message: ${transaction.responseMessage || "–"}`,
      `Narration: ${transaction.narration || "–"}`,
      `Date/Time: ${formatDateTime(transaction.dateTime)}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${transaction.sessionId || transaction.id || "transaction-receipt"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const submitStatusChange = async () => {
    if (!transaction || !statusReason.trim()) {
      toast.error("Enter a reason for the status change.");
      return;
    }
    setStatusSubmitting(true);
    try {
      const result = await requestTransactionStatusChange({
        transactionId: transaction.sessionId || transaction.id,
        newStatus: statusTarget,
        reason: statusReason.trim(),
        username: user?.username || user?.email || "",
        status: statusTarget,
      });
      const status = String(result?.status || "").toLowerCase();
      const message = String(result?.message || "").trim();
      if (status === "failed" || status === "error") {
        throw new APIError(message || "Status change failed.", 400, result);
      }
      toast.success(message || "Transaction status updated.");
      setStatusDialogOpen(false);
      setStatusReason("");
      await loadTransaction();
    } catch (error) {
      toast.error(error instanceof APIError ? error.message : "Unable to change transaction status.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/transactions")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaction Details</h1>
          <p className="text-gray-500 mt-1 break-all">
            {transaction?.sessionId || id}
            {transaction?.uuid ? ` · ${transaction.uuid}` : ""}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {canRequestStatusChange() ? (
            <Button variant="default" onClick={() => setStatusDialogOpen(true)} disabled={!transaction || isLoading}>
              Change status
            </Button>
          ) : null}
          <Button variant="outline" className="gap-2" onClick={loadTransaction} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Session: <strong>{transaction?.sessionId || id}</strong>
            </p>
            <p className="text-xs text-amber-700">Applies immediately. No approval required.</p>
            <div className="space-y-2">
              <Label>New status</Label>
              <Select value={statusTarget} onValueChange={setStatusTarget}>
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
              <Label htmlFor="vendor-status-reason">Reason</Label>
              <Input
                id="vendor-status-reason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Required"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={statusSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={submitStatusChange} disabled={statusSubmitting} className="gap-2">
              {statusSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Apply now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border bg-white px-6 py-12 text-center text-gray-500">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading transaction details...
          </div>
        </div>
      ) : !transaction ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Session ID</p>
                    <p className="font-medium break-all">{transaction.sessionId || "–"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reference</p>
                    <p className="font-medium break-all">{transaction.paymentReferenceNo || "–"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium">{formatDateTime(transaction.dateTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium">{transaction.type || "–"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="text-2xl font-bold text-green-600">{formatAmount(transaction.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <StatusBadge status={transaction.status} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Transaction status (message)</p>
                    <p className="font-medium text-sm">{formatStatusLabel(transaction)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Switch / channel data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <p className="text-gray-500">MTI</p>
                    <p className="font-medium font-mono">{displayField(transaction.mti)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Masked identifier</p>
                    <p className="font-medium font-mono">{displayField(transaction.maskedPan)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">STAN</p>
                    <p className="font-medium font-mono break-all">{displayField(transaction.stan)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">RRN</p>
                    <p className="font-medium font-mono break-all">{displayField(transaction.rrn)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Terminal ID</p>
                    <p className="font-medium font-mono break-all">{displayField(transaction.terminalId)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Duration</p>
                    <p className="font-medium">{formatDurationSecs(transactionDurationMs(transaction))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Request time</p>
                    <p className="font-medium whitespace-nowrap">{formatCardDateTime(transaction.requestTime)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Response time</p>
                    <p className="font-medium whitespace-nowrap">{formatCardDateTime(transaction.responseTime)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Merchant ID</p>
                    <p className="font-medium break-all">{displayField(transaction.merchantId)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Location</p>
                    <p className="font-medium">{displayField(transaction.locationNameAddress)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Processing code</p>
                    <p className="font-medium font-mono">{displayField(transaction.processingCode)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">ACQ ID</p>
                    <p className="font-medium font-mono break-all">{displayField(transaction.acqId)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">DEST ACQ ID</p>
                    <p className="font-medium font-mono break-all">{displayField(transaction.destAcqId)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Approval code</p>
                    <p className="font-medium font-mono">{displayField(transaction.approvalCode)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Contact number</p>
                    <p className="font-medium break-all">
                      {displayField(transaction.contactNumber || transaction.cardHolderNumber)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Reversed</p>
                    <p className="font-medium">{formatReversed(transaction.reversed)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">UUID</p>
                    <p className="font-medium font-mono text-xs break-all">{displayField(transaction.uuid)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Parties Involved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">From</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{transaction.sourceAccountName || "–"}</p>
                    <p className="text-sm text-gray-600">{transaction.sourceAccountNumber || "–"}</p>
                    <p className="text-sm text-gray-500">{transaction.sourceBank || "–"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">To</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{transaction.beneficiaryAccountName || "–"}</p>
                    <p className="text-sm text-gray-600">{transaction.beneficiaryAccountNumber || "–"}</p>
                    <p className="text-sm text-gray-500">{transaction.beneficiaryBank || "–"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Narration</p>
                  <p className="font-medium">{transaction.narration || "–"}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Response Code</p>
                    <p className="font-medium">{transaction.responseCode || "–"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Response Message</p>
                    <p className="font-medium">{transaction.responseMessage || "–"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full gap-2" onClick={handleDownloadReceipt}>
                  <Download className="w-4 h-4" />
                  Download Receipt
                </Button>
                {isOperator() && (
                  <Button variant="outline" className="w-full" onClick={() => navigate("/disputes/log")}>
                    Log Dispute
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => navigate("/transactions")}>
                  View Related Transactions
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timelineItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No timeline data returned by the backend.</p>
                  ) : (
                    timelineItems.map((item) => (
                      <div className="flex gap-3" key={`${item.label}-${item.date}`}>
                        <div className={`w-2 h-2 rounded-full mt-2 ${item.tone}`} />
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(item.date)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
