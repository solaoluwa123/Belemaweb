import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
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
import { Plus, Edit, Trash2, ArrowLeft, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import { fetchContactsForInstitution } from "../../services/financialInstitutions";
import { resetUser2faWithApi } from "../../services/usersAdmin";
import { toast } from "sonner";
import { formatBackendDate } from "../../utils/formatters";
import {
  isValidNgPhoneLocal,
  toLocalPhoneDigits,
  toStoredPhoneNumber,
} from "../../utils/phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

const PHONE_ERROR = "Enter a valid 10-digit mobile number (e.g. 8012345678).";

function mapContactRow(c, institutionCode) {
  return {
    id: c.id,
    fullName: c.fullName || "",
    email: c.email || "",
    mobile: c.mobile || "",
    dateCreated: c.dateCreated || "",
    institutionId: institutionCode || c.institutionCode || "",
  };
}

export default function InstitutionContacts() {
  const { institutionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const requester = String(user?.username || user?.email || "").trim();
  const adminUser = typeof isAdmin === "function" ? isAdmin() : false;
  const institutionCode = institutionId || "";
  const institutionName = location.state?.institutionName || institutionCode || "Institution";

  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadContacts = useCallback(async () => {
    if (!institutionCode) return;
    setIsLoading(true);
    setLoadError("");
    try {
      const rows = await fetchContactsForInstitution(institutionCode);
      setContacts(rows.map((c) => mapContactRow(c, institutionCode)));
    } catch (e) {
      setContacts([]);
      setLoadError(e instanceof APIError ? e.message : "Unable to load contacts.");
    } finally {
      setIsLoading(false);
    }
  }, [institutionCode]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const [pageSize, setPageSize] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [contactToReset2fa, setContactToReset2fa] = useState(null);
  const [formError, setFormError] = useState("");
  const emptyForm = { fullName: "", email: "", mobile: "" };
  const [form, setForm] = useState(emptyForm);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const q = searchTerm.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.mobile && String(c.mobile).toLowerCase().includes(q)) ||
        (c.dateCreated && c.dateCreated.toLowerCase().includes(q))
    );
  }, [contacts, searchTerm]);

  const paginatedContacts = useMemo(() => {
    return filteredContacts.slice(0, pageSize);
  }, [filteredContacts, pageSize]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    if (!form.fullName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setFormError("Enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!isValidNgPhoneLocal(form.mobile)) {
      setFormError(PHONE_ERROR);
      return;
    }
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_CREATE,
        summary: `Add contact ${form.fullName.trim()} for institution ${institutionCode}`,
        payload: {
          institutionCode,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          mobile: toStoredPhoneNumber(form.mobile),
        },
        requestedBy: requester,
      });
      toast.success(
        adminUser
          ? "Contact created. A temporary password will be emailed."
          : "Contact creation submitted for approval."
      );
      setForm(emptyForm);
      setAddOpen(false);
      await loadContacts();
    } catch (err) {
      // Prefer the backend's specific message (e.g. "Email address already exist") over
      // the generic APIError message. The server returns it on `data.message`.
      const backendMessage =
        err instanceof APIError && err.data && typeof err.data === "object"
          ? String(err.data.message || "").trim()
          : "";
      const baseMessage = err instanceof APIError ? err.message : "Unable to submit change request.";
      setFormError(backendMessage ? `${baseMessage} (${backendMessage})` : baseMessage);
    }
  };

  const openEdit = (row) => {
    setEditingContact(row);
    setForm({
      ...emptyForm,
      fullName: row.fullName ?? "",
      email: row.email ?? "",
      mobile: toLocalPhoneDigits(row.mobile),
    });
    setFormError("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingContact) return;
    setFormError("");
    if (!requester) {
      setFormError("Your session is missing a username or email for the request.");
      return;
    }
    if (!form.fullName.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!isValidEmail(form.email)) {
      setFormError("Enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!isValidNgPhoneLocal(form.mobile)) {
      setFormError(PHONE_ERROR);
      return;
    }
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_UPDATE,
        summary: `Update contact ${editingContact.fullName} (${institutionCode})`,
        payload: {
          institutionCode,
          contactId: editingContact.id,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          mobile: toStoredPhoneNumber(form.mobile),
        },
        requestedBy: requester,
      });
      toast.success(
        adminUser
          ? "Contact updated."
          : "Contact update submitted for approval."
      );
      setEditingContact(null);
      setForm(emptyForm);
      await loadContacts();
    } catch (err) {
      setFormError(err instanceof APIError ? err.message : "Unable to submit change request.");
    }
  };

  const handleDelete = async () => {
    if (!contactToDelete || !requester) return;
    if (!adminUser) {
      toast.error("Only administrators can delete institution contacts.");
      setContactToDelete(null);
      return;
    }
    if (!contactToDelete.email) {
      toast.error("Contact email is required to delete.");
      return;
    }
    try {
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.INSTITUTION_CONTACT_DELETE,
        summary: `Delete contact ${contactToDelete.fullName} (${institutionCode})`,
        payload: {
          institutionCode,
          contactId: contactToDelete.id,
          email: contactToDelete.email,
        },
        requestedBy: requester,
      });
      toast.success("Contact deleted.");
      setContactToDelete(null);
      await loadContacts();
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to delete contact.");
    }
  };

  const handleReset2fa = async () => {
    if (!contactToReset2fa) return;
    if (!requester) {
      toast.error("Your session is missing a username or email for the request.");
      return;
    }
    if (!contactToReset2fa.email) {
      toast.error("Contact email is required to reset 2FA.");
      return;
    }
    try {
      await resetUser2faWithApi({
        email: contactToReset2fa.email,
        creator: requester,
      });
      toast.success(
        adminUser
          ? "2FA reset successfully. The contact must set up 2FA again on next login."
          : "2FA reset submitted for approval."
      );
      setContactToReset2fa(null);
    } catch (e) {
      toast.error(e instanceof APIError ? e.message : "Unable to reset 2FA.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => navigate("/admin/institutions")}>
            <ArrowLeft className="w-4 h-4" /> Back to Institutions
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
            Total {String(institutionName).toUpperCase()} Contacts
          </h1>
          <p className="text-gray-600 mt-1">Total: {filteredContacts.length}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadContacts} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              setForm(emptyForm);
              setFormError("");
              setAddOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add New Contact
          </Button>
        </div>
      </div>
      {loadError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="entries" className="text-sm whitespace-nowrap">
            Show
          </Label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger id="entries" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} entries
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label htmlFor="search-contacts" className="text-sm whitespace-nowrap">
            Search:
          </Label>
          <Input
            id="search-contacts"
            placeholder="Filter by Name, date, email,..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Loading…
                </TableCell>
              </TableRow>
            ) : paginatedContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No contacts found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedContacts.map((row) => (
                <TableRow key={`${row.institutionId}-${row.id}`}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.mobile || "—"}</TableCell>
                  <TableCell>{formatBackendDate(row.dateCreated)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.fullName}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-amber-700 hover:text-amber-800"
                        onClick={() => setContactToReset2fa(row)}
                        aria-label={`Reset 2FA for ${row.fullName}`}
                        title="Reset 2FA"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </Button>
                      {adminUser ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setContactToDelete(row)}
                          aria-label={`Delete ${row.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-2">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="add-fullName">Full Name *</Label>
              <Input
                id="add-fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email Address *</Label>
              <Input
                id="add-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-mobile">Mobile</Label>
              <div className="border-input flex h-9 w-full items-center overflow-hidden rounded-md border bg-input-background">
                <span className="text-muted-foreground shrink-0 select-none border-r px-3 text-sm">+234</span>
                <Input
                  id="add-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={form.mobile}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  placeholder="8012345678"
                  maxLength={10}
                  className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{adminUser ? "Create contact" : "Submit for approval"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name *</Label>
              <Input
                id="edit-fullName"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mobile">Mobile</Label>
              <div className="border-input flex h-9 w-full items-center overflow-hidden rounded-md border bg-input-background">
                <span className="text-muted-foreground shrink-0 select-none border-r px-3 text-sm">+234</span>
                <Input
                  id="edit-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={form.mobile}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  placeholder="8012345678"
                  maxLength={10}
                  className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
              <Button type="submit">{adminUser ? "Save" : "Submit for approval"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-gray-600">
            Delete <strong>{contactToDelete?.fullName}</strong>? This removes the contact immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactToReset2fa} onOpenChange={(open) => !open && setContactToReset2fa(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset 2FA</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-gray-600">
            Reset two-factor authentication for <strong>{contactToReset2fa?.fullName}</strong> (
            {contactToReset2fa?.email})? They will set up 2FA again on their next login.
            {!adminUser ? " This will be submitted for approval." : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactToReset2fa(null)}>
              Cancel
            </Button>
            <Button onClick={handleReset2fa}>Reset 2FA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
