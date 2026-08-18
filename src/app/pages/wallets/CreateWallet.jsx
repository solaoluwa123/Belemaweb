// Create Wallet Page
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useNavigate, Navigate } from "react-router";
import { ensureWalletTypeCache, resolveWalletTypeIdWithSource } from "../../services/wallets";
import { fetchInstitutionsList } from "../../services/financialInstitutions";
import { APIError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import { toast } from "sonner";

export default function CreateWallet() {
  const navigate = useNavigate();
  const { user, canSubmitRequests } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [walletTypeWarning, setWalletTypeWarning] = useState("");
  const [institutions, setInstitutions] = useState([]);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(true);
  const [institutionsError, setInstitutionsError] = useState("");

  const [formData, setFormData] = useState({
    accountName: "",
    accountType: "",
    currency: "NGN",
    institutionId: "",
    institutionName: "",
  });

  // Pre-seed the wallet-type inference cache from existing wallets so we send the server's
  // real `wallettype` FK ids instead of hard-coded client defaults that can throw 500 on approval.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await ensureWalletTypeCache();
        if (cancelled) return;
        if (!rows.length) {
          setWalletTypeWarning(
            "No existing wallets were found to infer real wallettype ids from. " +
              "If approval fails with a 500, your VITE_WALLET_TYPE_MAP likely doesn't match the server."
          );
        }
      } catch {
        // Silent — surfaces at submit time anyway.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the live institutions list from the backend so the dropdown uses the *real*
  // `tbl_financial_institutions.code` values that `tbl_wallets.financialInstitutionCode`
  // expects as a foreign key. Hard-coding codes here was the root cause of recurring
  // 500s on wallet approval (FK violation on insert).
  useEffect(() => {
    let cancelled = false;
    setIsLoadingInstitutions(true);
    setInstitutionsError("");
    (async () => {
      try {
        const list = await fetchInstitutionsList({ activeOnly: true });
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        setInstitutions(sorted);
        if (!sorted.length) {
          setInstitutionsError(
            "No active financial institutions returned by the server. Ask an admin to add one before creating wallets."
          );
        }
      } catch (error) {
        if (cancelled) return;
        setInstitutions([]);
        setInstitutionsError(
          error instanceof APIError
            ? `Could not load institutions: ${error.message}`
            : "Could not load institutions from the server."
        );
      } finally {
        if (!cancelled) setIsLoadingInstitutions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.accountName ||
      !formData.accountType ||
      !formData.institutionId ||
      !formData.institutionName
    ) {
      setErrorMessage("All fields are required.");
      return;
    }

    const matchedInstitution = institutions.find(
      (item) => item.code === formData.institutionId
    );
    if (!matchedInstitution) {
      setErrorMessage(
        "Selected institution is not in the live list. Please reload and pick a current institution."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Make sure we have the server's real wallettype FK ids before submitting.
      await ensureWalletTypeCache();
      const { id: walletTypeId, source } = resolveWalletTypeIdWithSource(formData.accountType);
      if (walletTypeId === undefined) {
        throw new APIError(`Unsupported wallet type: ${formData.accountType}`, 400, null);
      }
      if (source === "default") {
        // Loud warning so the user can correlate later approval 500s with the wrong FK id.
        // eslint-disable-next-line no-console
        console.warn(
          `[CreateWallet] Using hard-coded default wallettype id ${walletTypeId} for "${formData.accountType}". ` +
            `If approval throws 500, set VITE_WALLET_TYPE_MAP in .env.development to match your server's tbl_wallet_types ids.`
        );
      }
      const creator = user?.username || user?.email || "system";
      const requestedBy = creator;
      // Send only the fields `WalletsService.Create` actually consumes (see WalletModel.java
      // and WalletsController line 47): creator, walletname, financialInstitutionCode,
      // wallettype. The backend overwrites `creationdate` with MySQL `now()` and generates
      // `walletnumber` itself, so sending `date_created` / `date_updated` / `walletnumber`
      // is misleading. Human-readable name fields are kept for server-log readability only.
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.WALLET_CREATE,
        summary: `Create wallet — ${formData.accountName.trim()}`,
        payload: {
          creator,
          walletname: formData.accountName.trim(),
          financialInstitutionCode: matchedInstitution.code,
          financialInstitutionName: matchedInstitution.name,
          walletTypeName: formData.accountType,
          wallettype: walletTypeId,
        },
        requestedBy,
      });

      setSuccessMessage("Request submitted for approver review.");
      toast.success("Wallet creation sent for approval. Track it under Approvals → Change requests.");

      setFormData({
        accountName: "",
        accountType: "",
        currency: "NGN",
        institutionId: "",
        institutionName: "",
      });

      setTimeout(() => {
        navigate("/approvals/change-requests");
      }, 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof APIError
          ? error.message
          : "Unable to create wallet."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canSubmitRequests()) {
    return <Navigate to="/wallets" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Create Wallet</h1>

      {errorMessage && (
        <div className="text-red-600 text-sm">{errorMessage}</div>
      )}
      {successMessage && (
        <div className="text-green-600 text-sm">{successMessage}</div>
      )}
      {walletTypeWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {walletTypeWarning}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Wallet Information</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Wallet Name */}
            <div className="space-y-2">
              <Label htmlFor="accountName">Wallet Name *</Label>
              <Input
                id="accountName"
                value={formData.accountName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    accountName: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* Wallet Type */}
            <div className="space-y-2">
              <Label>Wallet Type *</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    accountType: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ FIXED values to match backend */}
                  <SelectItem value="Merchant">Merchant</SelectItem>
                  <SelectItem value="PSSP">PSSP</SelectItem>
                  <SelectItem value="PTSP">PTSP</SelectItem>
                  <SelectItem value="Super Agent">Super Agent</SelectItem>
                  <SelectItem value="Switch">Switch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Institution */}
            <div className="space-y-2">
              <Label>Financial Institution *</Label>
              <Select
                value={formData.institutionId}
                onValueChange={(value) => {
                  const match = institutions.find((item) => item.code === value);
                  setFormData((prev) => ({
                    ...prev,
                    institutionId: value,
                    institutionName: match ? match.name : "",
                  }));
                }}
                disabled={isLoadingInstitutions || institutions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingInstitutions
                        ? "Loading institutions..."
                        : institutions.length === 0
                          ? "No institutions available"
                          : "Select institution"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name}
                      <span className="ml-2 text-xs text-slate-500">({item.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {institutionsError && (
                <p className="text-xs text-red-600">{institutionsError}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Wallet"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/wallets")}
              >
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}