import { useEffect, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { Loader2, RefreshCcw, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { approveDisputes, fetchDisputes } from "../../services/disputes";
import { formatBackendDate } from "../../utils/formatters";
import { toast } from "sonner";
import { Navigate } from "react-router";

export default function DisputesList() {
  const { user, isThirdPartyVendor, canApproveSwitchDispute, requiresInstitutionScope } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actingId, setActingId] = useState(null);

  const institutionCode = user?.institutionCode || "";
  const requireScope = requiresInstitutionScope();

  const columns = [
    { key: "id", label: "Dispute ID", sortable: true },
    { key: "transactionId", label: "Transaction ID", sortable: true },
    {
      key: "submittedDate",
      label: "Date",
      sortable: true,
      render: (value) => formatBackendDate(value, { fallback: "–" }),
    },
    { key: "submittedBy", label: "Submitted By" },
    { key: "reason", label: "Reason" },
    { key: "amount", label: "Amount", render: (value) => `₦${Number(value || 0).toLocaleString()}` },
    {
      key: "status",
      label: "Status",
      render: (value, row) => (
        <StatusBadge status={row.originalStatus || value} type="dispute" />
      ),
    },
    ...(canApproveSwitchDispute()
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (_, row) => {
              const pending =
                String(row.status || "").toLowerCase() === "pending" ||
                String(row.originalStatus || "").toLowerCase().includes("pending");
              if (!pending) return "–";
              const busy = actingId === row.id;
              return (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleApprove(row, "Accepted")}
                    className="h-8 gap-1"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleApprove(row, "Rejected")}
                    className="h-8 gap-1 text-rose-700"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  const load = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const disputes = await fetchDisputes({
        institutionCode,
        requireInstitutionScope: requireScope,
      });
      setRows(disputes);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load disputes.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (row, status) => {
    setActingId(row.id);
    try {
      await approveDisputes({
        status,
        selectedDisputes: row.id,
        username: user?.username || user?.email || "",
        type: row.disputeType || row.newStatusCode || "",
      });
      toast.success(status === "Accepted" ? "Dispute accepted." : "Dispute rejected.");
      await load();
    } catch (error) {
      toast.error(error instanceof APIError ? error.message : "Unable to update dispute.");
    } finally {
      setActingId(null);
    }
  };

  useEffect(() => {
    load();
  }, [institutionCode]);

  if (!isThirdPartyVendor()) {
    return <Navigate to="/disputes/arbitrated" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Disputes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch disputes for your institution
            {institutionCode ? ` (${institutionCode})` : ""}.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2 shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      <DataTable data={rows} columns={columns} isLoading={isLoading} searchPlaceholder="Search disputes..." />
    </div>
  );
}
