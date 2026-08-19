import { useEffect, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Plus, Eye, Download, Loader2, RefreshCcw, Pencil, Trash2, Power } from "lucide-react";
import { useNavigate } from "react-router";
import { APIError } from "../../services/api";
import { fetchWallets } from "../../services/wallets";
import { useAuth } from "../../context/AuthContext";
import { CHANGE_RESOURCE_TYPES, submitChangeRequest } from "../../services/changeRequests";
import { toast } from "sonner";
import { formatBackendDate } from "../../utils/formatters";

export default function WalletList() {
  const navigate = useNavigate();
  const { canMutateWallets: canMutateWalletsFlag, user, requiresInstitutionScope } = useAuth();
  const canMutateWallets = canMutateWalletsFlag();
  const institutionCode = user?.institutionCode || "";
  const requester = String(user?.username || user?.email || "").trim();
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadWallets = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const walletRows = await fetchWallets({
        institutionCode,
        requireInstitutionScope: requiresInstitutionScope(),
      });
      setWallets(walletRows);
    } catch (error) {
      setWallets([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load wallets.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.accountName || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editRow || !editName.trim()) return;
    setIsSavingEdit(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (!requester) throw new APIError("Missing user identity.", 400, null);
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.WALLET_EDIT,
        summary: `Rename wallet ${editRow.accountNumber} → ${editName.trim()}`,
        payload: {
          walletId: editRow.id,
          accountNumber: editRow.accountNumber,
          accountName: editName.trim(),
          walletnumber: editRow.accountNumber,
          walletname: editName.trim(),
        },
        requestedBy: requester,
      });
      toast.success("Rename request submitted for approval.");
      setSuccessMessage("Rename submitted for approver review.");
      setEditOpen(false);
      setEditRow(null);
      await loadWallets();
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to update wallet.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const toggleStatus = async (row, next) => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (!requester) throw new APIError("Missing user identity.", 400, null);
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.WALLET_STATUS,
        summary: `${next} wallet ${row.accountNumber}`,
        payload: {
          walletId: row.id,
          accountNumber: row.accountNumber,
          status: next,
        },
        requestedBy: requester,
      });
      toast.success("Status change submitted for approval.");
      setSuccessMessage(`Status change submitted for approver review (${next}).`);
      await loadWallets();
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to update status.");
    }
  };

  const confirmBulkDelete = async () => {
    if (!selectedRows.length) return;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      if (!requester) throw new APIError("Missing user identity.", 400, null);
      await submitChangeRequest({
        resourceType: CHANGE_RESOURCE_TYPES.WALLET_DELETE,
        summary: `Delete ${selectedRows.length} wallet(s)`,
        payload: { ids: selectedRows.map((r) => r.id) },
        requestedBy: requester,
      });
      toast.success("Deletion request submitted for approval.");
      setSuccessMessage("Deletion submitted for approver review.");
      setSelectedRows([]);
      setDeleteOpen(false);
      await loadWallets();
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to delete wallets.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    { key: "accountNumber", label: "Wallet number", sortable: true },
    { key: "accountName", label: "Wallet name", sortable: true },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      render: (value) => `NGN ${Number(value ?? 0).toLocaleString()}`,
    },
    { key: "currency", label: "Currency" },
    {
      key: "institutionName",
      label: "Institution",
      sortable: true,
      render: (_v, row) =>
        row.institutionName ||
        row.raw?.financialInstitutionName ||
        row.institutionId ||
        "—",
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: "createdDate",
      label: "Created",
      sortable: true,
      render: (value) => formatBackendDate(value),
    },
  ];

  const handleDownload = () => {
    const headers = ["Wallet number", "Wallet name", "Balance (NGN)", "Currency", "Status", "Created"];
    const rows = wallets.map((w) => [
      w.accountNumber,
      w.accountName,
      (w.balance ?? 0).toLocaleString(),
      w.currency ?? "",
      w.status ?? "",
      formatBackendDate(w.createdDate, { fallback: "" }),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actions = (row) => (
    <div className="flex justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="View activity"
        onClick={() => navigate(`/wallets/${encodeURIComponent(row.accountNumber || row.id)}/activity`)}
      >
        <Eye className="w-4 h-4" />
      </Button>
      {canMutateWallets && (
        <>
          <Button variant="ghost" size="icon" title="Edit name" onClick={() => openEdit(row)}>
            <Pencil className="w-4 h-4" />
          </Button>
          {String(row.status).toLowerCase() === "inactive" ? (
            <Button variant="ghost" size="icon" title="Activate" onClick={() => toggleStatus(row, "Active")}>
              <Power className="w-4 h-4 text-emerald-600" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" title="Deactivate" onClick={() => toggleStatus(row, "Inactive")}>
              <Power className="w-4 h-4 text-amber-600" />
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wallets</h1>
          <p className="text-gray-500 mt-1">
            {canMutateWallets
              ? "Manage wallet names, status, and open per-wallet activity"
              : "View wallet balances and activity (changes are submitted by operators and approved separately)"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={loadWallets} disabled={isLoading} className="gap-2 w-full sm:w-auto">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            className="gap-2 w-full sm:w-auto bg-black hover:bg-gray-800 text-white border-black"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          {canMutateWallets && (
            <>
              <Button
                variant="destructive"
                disabled={!selectedRows.length}
                onClick={() => setDeleteOpen(true)}
                className="gap-2 w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4" />
                Delete selected
              </Button>
              <Button onClick={() => navigate("/wallets/create")} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Create wallet
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Funding uses a separate maker–checker flow under <strong>Wallet → Fund wallet</strong> (not from this screen).
      </p>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      <DataTable
        data={wallets}
        columns={columns}
        actions={actions}
        selectable={canMutateWallets}
        onSelectionChange={setSelectedRows}
        isLoading={isLoading}
        emptyMessage="No wallets found."
        onRowClick={(row) => navigate(`/wallets/${encodeURIComponent(row.accountNumber || row.id)}/activity`)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Wallet number</Label>
              <Input value={editRow?.accountNumber ?? ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wallet-name">Wallet name *</Label>
              <Input
                id="edit-wallet-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete wallets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedRows.length} wallet record(s) from the list. This action cannot be undone in the demo environment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground">
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
