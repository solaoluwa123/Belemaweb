import { useEffect, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { CheckCircle, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  approveUserApproval,
  fetchUserApprovals,
  fetchUsersActionsDirectory,
  rejectUserApproval,
} from "../../services/approvals";
import { formatBackendDateTime } from "../../utils/formatters";
import { isAdministratorAccount, ROLE_IDS } from "../../utils/roleAccess";

function isAdminDeleteRequest(row) {
  const actionType = String(row?.raw?.actionType ?? row?.raw?.actiontype ?? "").trim().toLowerCase();
  if (actionType !== "delete") return false;
  return isAdministratorAccount({
    roleId: row?.raw?.roleid ?? row?.raw?.roleId ?? row?.raw?.role,
    roleName: row?.raw?.role_name ?? row?.raw?.roleName,
    raw: row?.raw,
  });
}

function isAdminCreateRequest(row) {
  const actionType = String(row?.raw?.actionType ?? row?.raw?.actiontype ?? "").trim().toLowerCase();
  if (actionType !== "create") return false;
  const roleId = Number(row?.raw?.roleid ?? row?.raw?.roleId ?? row?.raw?.role);
  return roleId === ROLE_IDS.ADMINISTRATOR || isAdministratorAccount(row?.raw);
}

export default function PendingUserApprovals() {
  const { user, isApprover, isAdmin } = useAuth();
  const canApprove = isApprover() || isAdmin();
  const approverIdentity = String(user?.username || user?.email || "").trim();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionsMeta, setActionsMeta] = useState(null);

  const loadApprovals = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setItems(await fetchUserApprovals());
    } catch (error) {
      setItems([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load user approvals.");
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
        const dir = await fetchUsersActionsDirectory();
        if (!cancelled) setActionsMeta(dir && typeof dir === "object" ? dir : null);
      } catch {
        if (!cancelled) setActionsMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApprove = async (row) => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const actionType = String(row?.raw?.actionType ?? row?.raw?.actiontype ?? "").trim().toLowerCase();
      await approveUserApproval({
        id: row.id,
        actionType,
        approverUsername: approverIdentity,
        isContactApproval: Boolean(row.isContactApproval || row.raw?.__userSegment === "contact"),
        institution: row.raw?.institution ?? row.raw?.financial_institution_code,
        raw: row.raw,
      });
      setSuccessMessage(`User approval ${row.id} approved successfully.`);
      await loadApprovals();
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to approve the user request.");
    }
  };

  const handleReject = async (row) => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await rejectUserApproval(row.id, {
        isContactApproval: Boolean(row.isContactApproval || row.raw?.__userSegment === "contact"),
        email: row.raw?.email_address ?? row.raw?.email ?? row.raw?.username,
        raw: row.raw,
      });
      setSuccessMessage(`User approval ${row.id} rejected successfully.`);
      await loadApprovals();
    } catch (error) {
      setErrorMessage(error instanceof APIError ? error.message : "Unable to reject the user request.");
    }
  };

  const columns = [
    { key: "id", label: "Approval ID", sortable: true },
    {
      key: "type",
      label: "User type",
      sortable: true,
      render: (value) => <span className="text-sm font-medium text-slate-700">{value || "User"}</span>,
    },
    { key: "submittedBy", label: "Submitted By", sortable: true },
    { key: "submittedDate", label: "Date", sortable: true, render: (value) => formatBackendDateTime(value) },
    { key: "details", label: "Details" },
    { key: "status", label: "Status", render: (value, row) => <StatusBadge status={row.status} type="approval" /> },
  ];

  const actions = (row) => {
    const blockedAdminDelete = isAdminDeleteRequest(row);
    const blockedAdminCreate = isAdminCreateRequest(row);
    const blocked = blockedAdminDelete || blockedAdminCreate;
    return (
    <div className="flex gap-2">
      {row.status === "Pending" && canApprove && !blocked && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="text-emerald-600 hover:bg-emerald-50"
            onClick={() => handleApprove(row)}
            aria-label="Approve"
            disabled={!approverIdentity || !String(row?.raw?.actionType ?? row?.raw?.actiontype ?? "").trim()}
            title={!String(row?.raw?.actionType ?? row?.raw?.actiontype ?? "").trim() ? "Missing actionType from API row" : undefined}
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-rose-600 hover:bg-rose-50" onClick={() => handleReject(row)} aria-label="Reject">
            <XCircle className="w-4 h-4" />
          </Button>
        </>
      )}
      {row.status === "Pending" && canApprove && blocked && (
        <>
          <span
            className="text-xs text-amber-700 self-center max-w-[12rem]"
            title={
              blockedAdminDelete
                ? "Administrator accounts cannot be deleted"
                : "Administrator accounts cannot be created through approvals"
            }
          >
            {blockedAdminDelete ? "Admin delete blocked" : "Admin create blocked"}
          </span>
          <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(row)} aria-label="Reject">
            <XCircle className="w-4 h-4" />
          </Button>
        </>
      )}
      {row.status === "Pending" && !canApprove && (
        <span className="text-sm text-gray-500">Awaiting approval</span>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Pending User Approvals</h1>
        <Button variant="outline" onClick={loadApprovals} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-gray-500 text-sm">
        {canApprove
          ? "Approve or reject pending users — system users, institution contacts, and other user roles."
          : "Requests you submitted are listed below. An approver or admin will review them."}
        {actionsMeta?.roles?.length ? (
          <span className="block mt-1 text-xs text-slate-500">
            Form directory from <code className="rounded bg-slate-100 px-1">GET /users/get/actions</code>: {actionsMeta.roles.length}{" "}
            role(s), {Array.isArray(actionsMeta.institutions) ? actionsMeta.institutions.length : 0} institution(s). Queue
            loads system, contact, and other-user pending rows from three list endpoints.
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
      <DataTable data={items} columns={columns} selectable actions={actions} isLoading={isLoading} emptyMessage="No user approvals returned by the backend." />
    </div>
  );
}
