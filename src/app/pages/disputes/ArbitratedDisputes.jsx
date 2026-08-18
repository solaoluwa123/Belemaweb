import { useEffect, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { fetchArbitratedDisputes } from "../../services/disputes";
import { formatBackendDate } from "../../utils/formatters";

export default function ArbitratedDisputes() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
  ];

  const load = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const disputes = await fetchArbitratedDisputes({
        institutionCode: user?.institutionCode || undefined,
      });
      setRows(disputes);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load arbitrated disputes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.institutionCode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Arbitrated Disputes</h1>
          {isAdmin() ? (
            <p className="mt-1 text-sm text-muted-foreground">Read-only access. Settlement actions are not available for your role.</p>
          ) : null}
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
      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No arbitrated disputes were returned by the backend."
      />
    </div>
  );
}
