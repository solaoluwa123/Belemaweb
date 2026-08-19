import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import { APIError } from "../../services/api";
import { fetchWalletActivity } from "../../services/wallets";
import { formatBackendDate, formatBackendTime, formatEmptyCell, formatJoinedCell, formatLocalYmd, getBackendDateTime } from "../../utils/formatters";

export default function WalletActivity() {
  const { id } = useParams();
  const [walletState, setWalletState] = useState({
    wallet: null,
    activities: [],
    totalCredit: 0,
    totalDebit: 0,
    currentBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadActivity = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchWalletActivity(id);
      setWalletState(data);
    } catch (error) {
      setWalletState({
        wallet: null,
        activities: [],
        totalCredit: 0,
        totalDebit: 0,
        currentBalance: 0,
      });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load wallet activity.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const todayYmd = formatLocalYmd();
  const todaysActivities = walletState.activities.filter((row) => {
    const t = getBackendDateTime(row.dateSort || row.date);
    if (!t) return false;
    const start = new Date(`${todayYmd}T00:00:00`).getTime();
    const end = new Date(`${todayYmd}T23:59:59.999`).getTime();
    return t >= start && t <= end;
  });

  const columns = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (_v, row) => formatBackendDate(row.dateSort || row.date),
    },
    {
      key: "time",
      label: "Time",
      render: (_v, row) => formatBackendTime(row.dateSort || row.date),
    },
    {
      key: "details",
      label: "Transaction details",
      render: (_v, row) => {
        const label = formatEmptyCell(row.details) !== "empty"
          ? String(row.details).trim()
          : formatJoinedCell([row.type, row.reference]);
        return (
          <span className="max-w-md line-clamp-2 text-sm" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "flow",
      label: "Flow",
      render: (_v, row) => (
        <span className={row.isCredit ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>
          {row.flow || (row.isCredit ? "Inflow" : "Outflow")}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (value, row) => (
        <span className={row.isCredit ? "text-emerald-700" : "text-rose-700"}>
          {row.isCredit ? "+" : "−"}NGN {Number(value ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const w = walletState.wallet;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wallet activity</h1>
          <p className="text-gray-500 mt-1">
            {w ? (
              <>
                {w.accountName} · <span className="font-mono text-sm">{w.accountNumber}</span>
              </>
            ) : (
              <>Wallet: {id}</>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link to="/wallets/activities" className="text-primary underline-offset-2 hover:underline">
              All wallet activities
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              to={`/wallets/activities?wallet=${encodeURIComponent(w?.accountNumber || id || "")}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Same wallet in global log
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/wallets" className="text-primary underline-offset-2 hover:underline">
              Wallets
            </Link>
          </div>
        </div>
        <Button variant="outline" onClick={loadActivity} disabled={isLoading} className="gap-2 shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="w-full gap-0 self-start">
          <CardHeader className="space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-sm">Current balance</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <p className="text-2xl font-bold leading-tight">NGN {Number(walletState.currentBalance ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="w-full gap-0 self-start">
          <CardHeader className="space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-sm">Total inflow</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <p className="text-2xl font-bold leading-tight text-green-600">NGN {Number(walletState.totalCredit ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="w-full gap-0 self-start">
          <CardHeader className="space-y-0 pb-1.5 pt-4">
            <CardTitle className="text-sm">Total outflow</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <p className="text-2xl font-bold leading-tight text-red-600">NGN {Number(walletState.totalDebit ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={todaysActivities}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No wallet activity for today."
        initialPageSize={25}
      />
    </div>
  );
}
