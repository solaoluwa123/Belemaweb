import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useNavigate, Navigate } from "react-router";
import { APIError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import { toast } from "sonner";
import { createDispute, fetchDisputeTypes } from "../../services/disputes";

const FALLBACK_DISPUTE_TYPE_OPTIONS = [
  { value: "unauthorized", label: "Unauthorized Transaction" },
  { value: "incorrect_amount", label: "Incorrect Amount" },
  { value: "duplicate", label: "Duplicate Transaction" },
  { value: "non_receipt", label: "Non-Receipt of Funds" },
  { value: "technical", label: "Technical Error" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

export default function LogDispute() {
  const { canSubmitRequests, canLogSwitchDispute, isThirdPartyVendor, user } = useAuth();
  const isVendor = isThirdPartyVendor();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    transactionId: "",
    disputeType: "",
    reason: "",
    amount: "",
    description: "",
  });
  const [typeOptions, setTypeOptions] = useState(FALLBACK_DISPUTE_TYPE_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchDisputeTypes();
        if (!cancelled && list.length) setTypeOptions(list);
      } catch {
        if (!cancelled) setTypeOptions(FALLBACK_DISPUTE_TYPE_OPTIONS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!canLogSwitchDispute()) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      const requestedBy = String(user?.username || user?.email || "operator").trim();
      const loggingInstitution = String(
        user?.financial_institution_code ||
          user?.financialInstitutionCode ||
          user?.institutionCode ||
          ""
      ).trim();

      if (isVendor) {
        await createDispute({
          transactionId: formData.transactionId,
          disputeType: formData.disputeType,
          reason: formData.reason,
          amount: formData.amount,
          description: formData.description,
          submittedBy: requestedBy,
          loggingInstitution,
        });
        toast.success("Dispute logged successfully.");
      } else {
        await submitChangeRequest({
          resourceType: CHANGE_RESOURCE_TYPES.DISPUTE_CREATE,
          summary: `Log dispute — ${formData.transactionId}`,
          payload: {
            transactionId: formData.transactionId,
            type: formData.disputeType,
            narration: formData.reason,
            description: formData.description,
            srcAmount: String(formData.amount),
            submittedBy: requestedBy,
            loggingInstitution,
          },
          requestedBy,
        });
        toast.success("Dispute submission sent for approval.");
      }
      setSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to submit the dispute.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle>Dispute Logged Successfully</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              {isVendor
                ? "Your dispute has been created and is available in the disputes list."
                : "Your dispute request was submitted. An approver must accept it before it appears in the disputes list."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(isVendor ? "/disputes" : "/transactions")}>
                {isVendor ? "View disputes" : "Back to transactions"}
              </Button>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Log Another Dispute
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-8 h-8 text-yellow-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Log Dispute</h1>
          <p className="text-gray-500 mt-1">Submit a transaction dispute for review</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispute Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID *</Label>
              <Input
                id="transactionId"
                placeholder="Enter transaction ID"
                value={formData.transactionId}
                onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disputeType">Dispute Type *</Label>
              <Select
                value={formData.disputeType}
                onValueChange={(value) => setFormData({ ...formData, disputeType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dispute type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Dispute Amount *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Input
                id="reason"
                placeholder="Brief reason for dispute"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about the dispute..."
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            {!isVendor ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your dispute will be reviewed by the approval team. You will
                  be notified of the outcome via email.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Only successful transactions (response code 00) can be disputed.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Dispute"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/transactions")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
