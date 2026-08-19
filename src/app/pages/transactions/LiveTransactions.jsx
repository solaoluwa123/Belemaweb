import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Activity, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { APIError } from "../../services/api";
import { fetchLiveTransactions } from "../../services/transactions";
import { formatBackendTime } from "../../utils/formatters";

export default function LiveTransactions() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTransactions = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchLiveTransactions();
      setRows(data);
    } catch (error) {
      const message =
        error instanceof APIError && error.status === 401
          ? "Your session is not authorized for live transactions."
          : error instanceof APIError
            ? error.message
            : "Unable to load live transactions.";
      setRows([]);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "dateTime",
        label: "Time",
        render: (value) => formatBackendTime(value),
      },
      { key: "sessionId", label: "Transaction ID" },
      { key: "sourceAccountName", label: "From" },
      { key: "beneficiaryAccountName", label: "To" },
      {
        key: "amount",
        label: "Amount",
        render: (value) =>
          `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      { key: "status", label: "Status", render: (value) => <StatusBadge status={value} /> },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Transactions</h1>
          <p className="text-gray-500 mt-1">Auto-refreshing transaction stream from the backend</p>
        </div>
        <Button variant="outline" className="ml-auto gap-2" onClick={loadTransactions} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh now
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
        onRowClick={(row) => navigate(`/transactions/${encodeURIComponent(row.sessionId || row.id)}`)}
        emptyMessage="No live transactions returned by the backend."
      />
    </div>
  );
}
