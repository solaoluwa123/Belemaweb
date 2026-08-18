import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DataTable } from "../../components/shared/DataTable";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Loader2, RefreshCcw } from "lucide-react";
import { APIError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { fetchAllWalletActivities, fetchWallets } from "../../services/wallets";
import { formatBackendDate, formatBackendTime, getBackendDateTime } from "../../utils/formatters";

const POLL_MS = 12000;

export default function WalletActivitiesAll() {
  const { user, requiresInstitutionScope } = useAuth();
  const institutionCode = user?.institutionCode || "";
  const requireScope = requiresInstitutionScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const walletFromUrl = searchParams.get("wallet") || "";

  const [rows, setRows] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filterWallet, setFilterWallet] = useState(walletFromUrl);
  const [filterInstitution, setFilterInstitution] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const walletList = await fetchWallets({
        institutionCode,
        requireInstitutionScope: requireScope,
      });
      const activity = await fetchAllWalletActivities();
      const walletNumbers = new Set(walletList.map((w) => String(w.walletNumber || w.id || "").trim()));
      const scopedActivity = requireScope
        ? activity.filter((row) => walletNumbers.has(String(row.walletNumber || "").trim()))
        : activity;
      setRows(scopedActivity);
      setWallets(walletList);
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load wallet activities.");
    } finally {
      setIsLoading(false);
    }
  }, [institutionCode, requireScope]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (walletFromUrl) setFilterWallet(walletFromUrl);
  }, [walletFromUrl]);

  const institutionOptions = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (r.institutionId) m.set(r.institutionId, r.institutionName || r.institutionId);
    });
    wallets.forEach((w) => {
      if (w.institutionId) m.set(w.institutionId, w.institutionName || w.institutionId);
    });
    return Array.from(m.entries()).map(([value, label]) => ({ value, label }));
  }, [rows, wallets]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterWallet && r.walletNumber !== filterWallet && r.walletId !== filterWallet) return false;
      if (filterInstitution && r.institutionId !== filterInstitution) return false;
      const t = getBackendDateTime(r.dateSort || r.date);
      if (!t) return !dateFrom && !dateTo;
      if (dateFrom) {
        const start = new Date(dateFrom + "T00:00:00").getTime();
        if (t < start) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo + "T23:59:59.999").getTime();
        if (t > end) return false;
      }
      return true;
    });
  }, [rows, filterWallet, filterInstitution, dateFrom, dateTo]);

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
      render: (_v, row) => (
        <span className="max-w-md line-clamp-2 text-sm" title={row.details}>
          {row.details || `${row.type} — ${row.reference}`}
        </span>
      ),
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
      key: "walletNumber",
      label: "Wallet",
      render: (_v, row) => (
        <Link
          to={`/wallets/${encodeURIComponent(row.walletNumber || row.walletId)}/activity`}
          className="text-primary underline-offset-2 hover:underline text-sm"
        >
          {row.walletName ? `${row.walletNumber} · ${row.walletName}` : row.walletNumber || row.walletId}
        </Link>
      ),
    },
    { key: "institutionName", label: "Institution", render: (v) => v || "—" },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  const syncWalletToUrl = (num) => {
    setFilterWallet(num);
    const next = new URLSearchParams(searchParams);
    if (num) next.set("wallet", num);
    else next.delete("wallet");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wallet activities</h1>
          <p className="text-gray-500 mt-1">
            Unified transaction log across all wallets (inflow / outflow). Refined by filters unless you leave them blank.
            Refreshes every {POLL_MS / 1000}s.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Open a specific wallet from{" "}
            <Link to="/wallets" className="text-primary underline-offset-2 hover:underline">
              View wallets
            </Link>{" "}
            or filter below.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2 shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh now
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 rounded-lg border bg-card p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Wallet</Label>
          <Select value={filterWallet || "__all__"} onValueChange={(v) => syncWalletToUrl(v === "__all__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All wallets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All wallets</SelectItem>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={w.accountNumber}>
                  {w.accountNumber} — {w.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Institution</Label>
          <Select value={filterInstitution || "__all__"} onValueChange={(v) => setFilterInstitution(v === "__all__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All institutions</SelectItem>
              {institutionOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="act-from">From date</Label>
          <input
            id="act-from"
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="act-to">To date</Label>
          <input
            id="act-to"
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No activities match your filters."
        initialPageSize={25}
      />
    </div>
  );
}
