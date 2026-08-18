import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
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
import { Plus, Edit, Ban, Loader2, RefreshCcw } from "lucide-react";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { FilterBar } from "../../components/shared/FilterBar";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import {
  fetchAllContacts,
  fetchInstitutionsFull,
  fetchInstitutionTypeList,
  institutionToTableRow,
} from "../../services/financialInstitutions";
import { toast } from "sonner";
import { formatBackendDate } from "../../utils/formatters";
import { resolveWalletTypeIdWithSource } from "../../services/wallets";

const EMPTY_FORM = {
  code: "",
  businessName: "",
  shortName: "",
  businessAddress: "",
  portNumber: "",
  businessType: "",
  chargeAmount: "",
  vat: "",
  password: "",
  cbnBankAccount: "",
  hashKey: "",
  publickeylocation: "",
  isProcessTSQ: false,
  isSettlementBank: false,
  enableInwardTransactions: false,
  serverIP: "localhost",
  neTimeout: "5",
  ftTimeout: "10",
  url: "",
  urlTSQ: "",
  neEnvelope: "",
  neResponseStartTag: "",
  neResponseEndTag: "",
  ftEnvelope: "",
  ftResponseStartTag: "",
  ftResponseEndTag: "",
  tsqEnvelope: "",
  tsqResponseStartTag: "",
  tsqResponseEndTag: "",
  walletname: "",
  walletTypeName: "",
  wallettype: 0,
  color: "",
};

function typeIdOf(typeRow) {
  if (typeRow == null || typeof typeRow !== "object") return "";
  const id = typeRow.id ?? typeRow.typeId;
  return id == null ? "" : String(id);
}

function typeNameOf(typeRow) {
  if (typeRow == null || typeof typeRow !== "object") return String(typeRow || "");
  return String(typeRow.name || typeRow.label || typeRow.type || "").trim();
}

function isFiniteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return false;
  return Number.isFinite(Number(value));
}

function validateInstitutionForm(form, { requireSecrets, isCreate }) {
  const code = form.code.trim();
  if (!code) return "Institution code is required.";
  if (!/^\d{1,6}$/.test(code)) return "Institution code must be 1 to 6 digits.";
  if (!form.businessName.trim()) return "Business name is required.";
  if (!form.shortName.trim()) return "Short name is required.";
  if (!form.businessType) return "Institution type is required.";
  if (!form.businessAddress.trim()) return "Business address is required.";
  if (!isFiniteNumber(form.portNumber)) return "Port number is required.";
  if (!form.publickeylocation.trim()) return "Public key location is required.";
  if (!isFiniteNumber(form.chargeAmount)) return "Charge amount is required.";
  if (!isFiniteNumber(form.vat)) return "Value Added Tax is required.";
  if (form.isSettlementBank === true && !form.cbnBankAccount.trim()) {
    return "Central Bank of Nigeria bank account is required when Settlement bank is Yes.";
  }
  if (requireSecrets) {
    if (!form.password) return "Switch password is required.";
    if (!form.hashKey.trim()) return "Hash key is required.";
  }
  if (isCreate) {
    if (!form.serverIP.trim()) return "Server IP is required.";
    if (!isFiniteNumber(form.neTimeout)) return "Name enquiry timeout is required.";
    if (!isFiniteNumber(form.ftTimeout)) return "Funds transfer timeout is required.";
    if (form.isSettlementBank !== true && (!form.walletname.trim() || !form.walletTypeName)) {
      return "Create a wallet before submitting when Settlement bank is No.";
    }
  }
  return "";
}

function formToApiPayload(form, extras = {}) {
  const isSettlement = form.isSettlementBank === true;
  const enableInward = form.enableInwardTransactions === true;
  return {
    code: form.code.trim(),
    name: form.businessName.trim(),
    shortName: form.shortName.trim(),
    business_address: form.businessAddress.trim(),
    port_number: Number(form.portNumber),
    businessType: Number(form.businessType),
    charge_amount: Number(form.chargeAmount),
    vat: Number(form.vat),
    cbn_bank_account: isSettlement ? form.cbnBankAccount.trim() : "",
    publickeylocation: form.publickeylocation.trim(),
    isProcessTSQ: form.isProcessTSQ ? 1 : 0,
    issettlementbank: isSettlement ? 1 : 0,
    instWithWallet: isSettlement ? 0 : 1,
    enableInward: enableInward ? 1 : 0,
    serverIP: form.serverIP.trim() || "localhost",
    neTimeout: Number(form.neTimeout) || 5,
    ftTimeout: Number(form.ftTimeout) || 10,
    url: enableInward ? form.url.trim() : "",
    urlTSQ: enableInward ? form.urlTSQ.trim() : "",
    neEnvelope: enableInward ? form.neEnvelope.trim() : "",
    neResponseStartTag: enableInward ? form.neResponseStartTag.trim() : "",
    neResponseEndTag: enableInward ? form.neResponseEndTag.trim() : "",
    ftEnvelope: enableInward ? form.ftEnvelope.trim() : "",
    ftResponseStartTag: enableInward ? form.ftResponseStartTag.trim() : "",
    ftResponseEndTag: enableInward ? form.ftResponseEndTag.trim() : "",
    tsqEnvelope: enableInward ? form.tsqEnvelope.trim() : "",
    tsqResponseStartTag: enableInward ? form.tsqResponseStartTag.trim() : "",
    tsqResponseEndTag: enableInward ? form.tsqResponseEndTag.trim() : "",
    color: form.color.trim(),
    ...extras,
  };
}

function YesNoSwitch({ id, label, checked, onCheckedChange }) {
  return (
    <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">No</span>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <span className="text-xs text-slate-500">Yes</span>
      </div>
    </div>
  );
}

function InstitutionFormFields({ form, setForm, types, includeSecrets, includeCreateExtras, onSettlementChange, idPrefix }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-code`}>Institution code *</Label>
        <Input
          id={`${idPrefix}-code`}
          value={form.code}
          inputMode="numeric"
          maxLength={6}
          onChange={(e) =>
            setForm((p) => ({ ...p, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))
          }
          placeholder="e.g. 058"
          disabled={idPrefix === "edit-fi"}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-shortName`}>Short Name *</Label>
        <Input
          id={`${idPrefix}-shortName`}
          value={form.shortName}
          onChange={(e) => setForm((p) => ({ ...p, shortName: e.target.value }))}
          placeholder="e.g. GTB"
        />
      </div>
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor={`${idPrefix}-businessName`}>Business Name *</Label>
        <Input
          id={`${idPrefix}-businessName`}
          value={form.businessName}
          onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
          placeholder="Full business name"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Type *</Label>
        <Select value={form.businessType || undefined} onValueChange={(v) => setForm((p) => ({ ...p, businessType: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {types.map((typeRow) => {
              const id = typeIdOf(typeRow);
              if (!id) return null;
              return (
                <SelectItem key={id} value={id}>
                  {typeNameOf(typeRow) || id}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-color`}>Color</Label>
        <Input
          id={`${idPrefix}-color`}
          value={form.color}
          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Business Address *</Label>
        <Input
          id={`${idPrefix}-address`}
          value={form.businessAddress}
          onChange={(e) => setForm((p) => ({ ...p, businessAddress: e.target.value }))}
          placeholder="Address"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-port`}>Port Number *</Label>
        <Input
          id={`${idPrefix}-port`}
          type="number"
          value={form.portNumber}
          onChange={(e) => setForm((p) => ({ ...p, portNumber: e.target.value }))}
          placeholder="e.g. 443"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-publickey`}>Public key location *</Label>
        <Input
          id={`${idPrefix}-publickey`}
          value={form.publickeylocation}
          onChange={(e) => setForm((p) => ({ ...p, publickeylocation: e.target.value }))}
          placeholder="Path or URL"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-charge`}>Charge amount *</Label>
        <Input
          id={`${idPrefix}-charge`}
          type="number"
          step="0.01"
          value={form.chargeAmount}
          onChange={(e) => setForm((p) => ({ ...p, chargeAmount: e.target.value }))}
          placeholder="e.g. 50"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-vat`}>Value Added Tax *</Label>
        <Input
          id={`${idPrefix}-vat`}
          type="number"
          step="0.01"
          value={form.vat}
          onChange={(e) => setForm((p) => ({ ...p, vat: e.target.value }))}
          placeholder="e.g. 7.5"
        />
      </div>
      {includeSecrets ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-password`}>Switch password *</Label>
            <Input
              id={`${idPrefix}-password`}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-hashKey`}>Hash key *</Label>
            <Input
              id={`${idPrefix}-hashKey`}
              value={form.hashKey}
              onChange={(e) => setForm((p) => ({ ...p, hashKey: e.target.value }))}
            />
          </div>
        </>
      ) : null}
      {includeCreateExtras ? (
        <>
          <YesNoSwitch
            id={`${idPrefix}-tsq`}
            label="Process transaction status query"
            checked={!!form.isProcessTSQ}
            onCheckedChange={(checked) => setForm((p) => ({ ...p, isProcessTSQ: checked === true }))}
          />
          <YesNoSwitch
            id={`${idPrefix}-settlement`}
            label="Settlement bank"
            checked={form.isSettlementBank === true}
            onCheckedChange={(checked) => {
              const yes = checked === true;
              setForm((p) => ({
                ...p,
                isSettlementBank: yes,
                ...(yes ? { walletname: "", walletTypeName: "", wallettype: 0 } : { cbnBankAccount: "" }),
              }));
              if (typeof onSettlementChange === "function") {
                onSettlementChange(yes);
              }
            }}
          />
          {form.isSettlementBank === true ? (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor={`${idPrefix}-cbn`}>Central Bank of Nigeria bank account *</Label>
              <Input
                id={`${idPrefix}-cbn`}
                value={form.cbnBankAccount}
                onChange={(e) => setForm((p) => ({ ...p, cbnBankAccount: e.target.value }))}
                placeholder="Settlement account"
              />
            </div>
          ) : (
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                {form.walletname
                  ? <>Wallet: <span className="font-medium">{form.walletname}</span>{form.walletTypeName ? ` (${form.walletTypeName})` : ""}</>
                  : "Settlement bank is No — create a wallet for this institution."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => typeof onSettlementChange === "function" && onSettlementChange(false)}
              >
                {form.walletname ? "Change wallet" : "Create wallet"}
              </Button>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-serverIP`}>Server IP address *</Label>
            <Input
              id={`${idPrefix}-serverIP`}
              value={form.serverIP}
              onChange={(e) => setForm((p) => ({ ...p, serverIP: e.target.value }))}
              placeholder="localhost"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-neTimeout`}>Name enquiry timeout (seconds) *</Label>
            <Input
              id={`${idPrefix}-neTimeout`}
              type="number"
              value={form.neTimeout}
              onChange={(e) => setForm((p) => ({ ...p, neTimeout: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-ftTimeout`}>Funds transfer timeout (seconds) *</Label>
            <Input
              id={`${idPrefix}-ftTimeout`}
              type="number"
              value={form.ftTimeout}
              onChange={(e) => setForm((p) => ({ ...p, ftTimeout: e.target.value }))}
            />
          </div>
          <YesNoSwitch
            id={`${idPrefix}-inward`}
            label="Enable inward transactions"
            checked={form.enableInwardTransactions === true}
            onCheckedChange={(checked) => {
              const yes = checked === true;
              setForm((p) => ({
                ...p,
                enableInwardTransactions: yes,
                ...(yes
                  ? {}
                  : {
                      url: "",
                      urlTSQ: "",
                      neEnvelope: "",
                      neResponseStartTag: "",
                      neResponseEndTag: "",
                      ftEnvelope: "",
                      ftResponseStartTag: "",
                      ftResponseEndTag: "",
                      tsqEnvelope: "",
                      tsqResponseStartTag: "",
                      tsqResponseEndTag: "",
                    }),
              }));
            }}
          />
          {form.enableInwardTransactions === true ? (
            <>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-url`}>Name enquiry / funds transfer endpoint</Label>
                <Input
                  id={`${idPrefix}-url`}
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-urlTSQ`}>Transaction status query endpoint</Label>
                <Input
                  id={`${idPrefix}-urlTSQ`}
                  value={form.urlTSQ}
                  onChange={(e) => setForm((p) => ({ ...p, urlTSQ: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-neEnvelope`}>Name enquiry envelope</Label>
                <Textarea id={`${idPrefix}-neEnvelope`} value={form.neEnvelope} onChange={(e) => setForm((p) => ({ ...p, neEnvelope: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-neStart`}>Name enquiry response start tag</Label>
                <Input id={`${idPrefix}-neStart`} value={form.neResponseStartTag} onChange={(e) => setForm((p) => ({ ...p, neResponseStartTag: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-neEnd`}>Name enquiry response end tag</Label>
                <Input id={`${idPrefix}-neEnd`} value={form.neResponseEndTag} onChange={(e) => setForm((p) => ({ ...p, neResponseEndTag: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-ftEnvelope`}>Funds transfer envelope</Label>
                <Textarea id={`${idPrefix}-ftEnvelope`} value={form.ftEnvelope} onChange={(e) => setForm((p) => ({ ...p, ftEnvelope: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-ftStart`}>Funds transfer response start tag</Label>
                <Input id={`${idPrefix}-ftStart`} value={form.ftResponseStartTag} onChange={(e) => setForm((p) => ({ ...p, ftResponseStartTag: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-ftEnd`}>Funds transfer response end tag</Label>
                <Input id={`${idPrefix}-ftEnd`} value={form.ftResponseEndTag} onChange={(e) => setForm((p) => ({ ...p, ftResponseEndTag: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor={`${idPrefix}-tsqEnvelope`}>Transaction status query envelope</Label>
                <Textarea id={`${idPrefix}-tsqEnvelope`} value={form.tsqEnvelope} onChange={(e) => setForm((p) => ({ ...p, tsqEnvelope: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-tsqStart`}>Transaction status query response start tag</Label>
                <Input id={`${idPrefix}-tsqStart`} value={form.tsqResponseStartTag} onChange={(e) => setForm((p) => ({ ...p, tsqResponseStartTag: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-tsqEnd`}>Transaction status query response end tag</Label>
                <Input id={`${idPrefix}-tsqEnd`} value={form.tsqResponseEndTag} onChange={(e) => setForm((p) => ({ ...p, tsqResponseEndTag: e.target.value }))} />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor={`${idPrefix}-cbn`}>Central Bank of Nigeria bank account</Label>
            <Input
              id={`${idPrefix}-cbn`}
              value={form.cbnBankAccount}
              onChange={(e) => setForm((p) => ({ ...p, cbnBankAccount: e.target.value }))}
              placeholder="Settlement account"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <Checkbox
              id={`${idPrefix}-tsq`}
              checked={!!form.isProcessTSQ}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, isProcessTSQ: checked === true }))}
            />
            <Label htmlFor={`${idPrefix}-tsq`} className="font-normal">
              Process transaction status query
            </Label>
          </div>
        </>
      )}
    </div>
  );
}

export default function FinancialInstitutions() {
  const { user, isAdmin } = useAuth();
  const adminUser = isAdmin();
  const requester = String(user?.username || user?.email || "").trim();
  const [institutions, setInstitutions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletDraft, setWalletDraft] = useState({ walletname: "", walletTypeName: "" });
  const [editingInstitution, setEditingInstitution] = useState(null);
  const [institutionToDeactivate, setInstitutionToDeactivate] = useState(null);
  const [institutionTypesFromTypesEndpoint, setInstitutionTypesFromTypesEndpoint] = useState([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [{ institutions: fiRows }, contacts, typeRows] = await Promise.all([
        fetchInstitutionsFull(),
        fetchAllContacts(),
        fetchInstitutionTypeList(),
      ]);
      setInstitutionTypesFromTypesEndpoint(Array.isArray(typeRows) ? typeRows : []);
      const counts = {};
      for (const c of contacts) {
        const code = String(c.institutionCode || "");
        if (!code) continue;
        counts[code] = (counts[code] || 0) + 1;
      }
      setInstitutions(fiRows.map((fi) => institutionToTableRow(fi, counts[String(fi.code || fi.institutionCode)] ?? 0)));
    } catch (e) {
      setInstitutions([]);
      setLoadError(e instanceof APIError ? e.message : "Unable to load institutions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return institutions
      .filter((row) => {
        if (appliedFilters.Type && !row.type.toLowerCase().includes(appliedFilters.Type.toLowerCase())) return false;
        if (appliedFilters.Status && row.status.toLowerCase() !== appliedFilters.Status.toLowerCase()) return false;
        if (appliedFilters.searchTerm) {
          const q = appliedFilters.searchTerm.toLowerCase();
          if (
            !(row.businessName || "").toLowerCase().includes(q) &&
            !(row.code || "").toLowerCase().includes(q) &&
            !(row.shortName || "").toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .map((row, index) => ({ ...row, sn: index + 1 }));
  }, [institutions, appliedFilters]);

  const addInstitution = async () => {
    setFormError("");
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    const validationError = validateInstitutionForm(form, { requireSecrets: true, isCreate: true });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const code = form.code.trim();
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_CREATE,
        summary: `Create institution ${form.businessName.trim()} (${code})`,
        payload: formToApiPayload(form, {
          password: form.password,
          hashKey: form.hashKey.trim(),
          ...(form.isSettlementBank !== true
            ? { walletname: form.walletname.trim(), wallettype: form.wallettype }
            : {}),
        }),
        requestedBy: requester,
      });
      toast.success(adminUser ? "Institution created." : "Institution creation submitted for approval.");
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to submit change request.");
    }
  };

  const openEditModal = (row) => {
    const raw = row._raw && typeof row._raw === "object" ? row._raw : {};
    const portNumber = row.portNumber === "-" ? "" : String(row.portNumber ?? raw.port_number ?? "");
    setEditingInstitution(row);
    setForm({
      ...EMPTY_FORM,
      code: row.code ?? "",
      businessName: row.businessName ?? "",
      shortName: row.shortName ?? "",
      businessAddress: row.businessAddress === "-" ? "" : row.businessAddress ?? "",
      portNumber,
      businessType: raw.businessType != null && raw.businessType !== "" ? String(raw.businessType) : "",
      chargeAmount: raw.charge_amount ?? raw.chargeAmount ?? "",
      vat: raw.vat ?? "",
      cbnBankAccount: raw.cbn_bank_account ?? raw.cbnBankAccount ?? "",
      publickeylocation: raw.publickeylocation ?? "",
      isProcessTSQ: Number(raw.isProcessTSQ) === 1,
      isSettlementBank: Number(raw.issettlementbank ?? raw.isSettlementBank) === 1,
      color: raw.color ?? "",
    });
    setFormError("");
  };

  const saveEditInstitution = async () => {
    if (!editingInstitution) return;
    setFormError("");
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    const validationError = validateInstitutionForm(form, { requireSecrets: false, isCreate: false });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_UPDATE,
        summary: `Update institution ${editingInstitution.code}`,
        payload: formToApiPayload(form, { code: editingInstitution.code }),
        requestedBy: requester,
      });
      toast.success(adminUser ? "Institution updated." : "Institution update submitted for approval.");
      setEditingInstitution(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      setFormError(e instanceof APIError ? e.message : "Unable to submit change request.");
    }
  };

  const confirmDeactivate = (row) => setInstitutionToDeactivate(row);

  const doDeactivate = async () => {
    if (!institutionToDeactivate || !requester) return;
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_DEACTIVATE,
        summary: `Deactivate institution ${institutionToDeactivate.code}`,
        payload: { code: institutionToDeactivate.code },
        requestedBy: requester,
      });
      toast.success(adminUser ? "Institution deactivated." : "Institution deactivation submitted for approval.");
      setInstitutionToDeactivate(null);
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to submit change request.");
    }
  };

  const columns = [
    { key: "sn", label: "S/N", sortable: false },
    { key: "businessName", label: "Business Name", sortable: true },
    { key: "shortName", label: "Short Name", sortable: true },
    { key: "businessAddress", label: "Business Address", sortable: true },
    { key: "code", label: "Code", sortable: true },
    { key: "portNumber", label: "Port Number", sortable: true },
    { key: "type", label: "Type", sortable: true },
    {
      key: "contacts",
      label: "Contacts",
      sortable: false,
      render: (_, row) => (
        <Link
          to={`/admin/institutions/${row.code}/contacts`}
          state={{ institutionName: row.businessName || row.shortName || row.code }}
          className="text-blue-600 hover:underline font-medium"
        >
          Contact
        </Link>
      ),
    },
    { key: "chargesVat", label: "Charges/VAT", sortable: true },
    {
      key: "dateCreated",
      label: "Date Created",
      sortable: true,
      render: (value) => formatBackendDate(value, { fallback: "-" }),
    },
    { key: "status", label: "Status", render: (value, row) => <StatusBadge status={row.status} /> },
  ];

  const actions = (row) => (
    <div className="flex justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="text-red-600 hover:text-red-700"
        onClick={() => openEditModal(row)}
        aria-label="Edit"
      >
        <Edit className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-red-600 hover:text-red-700"
        onClick={() => confirmDeactivate(row)}
        aria-label="Deactivate"
        title="Deactivate"
      >
        <Ban className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900">Financial Institutions (Accounts)</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setForm(EMPTY_FORM);
              setFormError("");
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Institution
          </Button>
        </div>
      </div>
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Add, edit, and deactivate actions are submitted for approver review. Applied changes appear after approval in{" "}
        <Link to="/approvals/change-requests" className="underline font-medium">
          Change requests
        </Link>
        .
        {institutionTypesFromTypesEndpoint.length > 0 ? (
          <span className="block mt-2 text-xs text-amber-900/90">
            Institution types from <code className="rounded bg-amber-100/80 px-1">GET /financial-institutions/types</code>:{" "}
            {institutionTypesFromTypesEndpoint
              .map((t) => typeNameOf(t))
              .filter(Boolean)
              .join(", ")}
          </span>
        ) : null}
      </p>
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : null}
      <FilterBar
        searchPlaceholder="Search by business name, short name or code..."
        onApplyFilters={setAppliedFilters}
        filters={[
          {
            type: "select",
            label: "Type",
            options: [
              { label: "All Types", value: "" },
              { label: "Bank", value: "bank" },
              { label: "Others", value: "others" },
            ],
          },
          {
            type: "select",
            label: "Status",
            options: [
              { label: "All Status", value: "" },
              { label: "Active", value: "active" },
              { label: "Suspended", value: "suspended" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
      />
      <DataTable data={filteredData} columns={columns} actions={actions} isLoading={isLoading} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Institution</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
            )}
            <InstitutionFormFields
              form={form}
              setForm={setForm}
              types={institutionTypesFromTypesEndpoint}
              includeSecrets
              includeCreateExtras
              onSettlementChange={(yes) => {
                if (!yes) {
                  setWalletDraft({
                    walletname: form.walletname || "",
                    walletTypeName: form.walletTypeName || "",
                  });
                  setWalletOpen(true);
                }
              }}
              idPrefix="fi"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addInstitution}>{adminUser ? "Submit" : "Submit for approval"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingInstitution} onOpenChange={(o) => !o && setEditingInstitution(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Institution</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
            )}
            <InstitutionFormFields
              form={form}
              setForm={setForm}
              types={institutionTypesFromTypesEndpoint}
              includeSecrets={false}
              idPrefix="edit-fi"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInstitution(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditInstitution}>{adminUser ? "Submit" : "Submit for approval"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create wallet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-slate-600">
              Settlement bank is No, so this institution uses a wallet. Institution code{" "}
              <span className="font-medium">{form.code || "(set on the institution form)"}</span>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="nested-wallet-name">Wallet name *</Label>
              <Input
                id="nested-wallet-name"
                value={walletDraft.walletname}
                onChange={(e) => setWalletDraft((p) => ({ ...p, walletname: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Wallet type *</Label>
              <Select
                value={walletDraft.walletTypeName || undefined}
                onValueChange={(value) => setWalletDraft((p) => ({ ...p, walletTypeName: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Merchant">Merchant</SelectItem>
                  <SelectItem value="PSSP">PSSP</SelectItem>
                  <SelectItem value="PTSP">PTSP</SelectItem>
                  <SelectItem value="Super Agent">Super Agent</SelectItem>
                  <SelectItem value="Switch">Switch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWalletOpen(false);
                setForm((p) => ({ ...p, isSettlementBank: true, walletname: "", walletTypeName: "", wallettype: 0 }));
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!walletDraft.walletname.trim() || !walletDraft.walletTypeName) {
                  toast.error("Wallet name and type are required.");
                  return;
                }
                const { id: walletTypeId } = resolveWalletTypeIdWithSource(walletDraft.walletTypeName);
                if (walletTypeId === undefined) {
                  toast.error("Unsupported wallet type.");
                  return;
                }
                setForm((p) => ({
                  ...p,
                  isSettlementBank: false,
                  walletname: walletDraft.walletname.trim(),
                  walletTypeName: walletDraft.walletTypeName,
                  wallettype: walletTypeId,
                }));
                setWalletOpen(false);
              }}
            >
              Save wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!institutionToDeactivate} onOpenChange={(o) => !o && setInstitutionToDeactivate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate institution</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-gray-600">
            {adminUser
              ? <>Deactivate <strong>{institutionToDeactivate?.businessName}</strong> ({institutionToDeactivate?.code})?</>
              : <>Submit a request to deactivate <strong>{institutionToDeactivate?.businessName}</strong> ({institutionToDeactivate?.code}
            )? An approver must confirm before the institution is set to Inactive.</>}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstitutionToDeactivate(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDeactivate}>
              {adminUser ? "Deactivate" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
