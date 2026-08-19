import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/shared/DataTable";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Loader2, RefreshCcw } from "lucide-react";
import { APIError } from "../../services/api";
import { fetchInstitutionWalletAggregates } from "../../services/wallets";
import { formatBackendDate, getBackendDateTime, parseBackendDate, formatLocalYmd } from "../../utils/formatters";

export default function InstitutionWalletActivity() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filterInstitution, setFilterInstitution] = useState("");
  const [dateFrom, setDateFrom] = useState(() => formatLocalYmd());
  const [dateTo, setDateTo] = useState(() => formatLocalYmd());

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchInstitutionWalletAggregates();
      setRows(
        data.map((r) => {
          const parsed = parseBackendDate(r.date);
          const day = parsed
            ? parsed.toISOString().slice(0, 10)
            : typeof r.date === "string"
              ? r.date.slice(0, 10)
              : "";
          return {
            ...r,
            id: r.id != null && r.id !== "" ? r.id : `${r.institutionId ?? "inst"}|${day || "unknown"}`,
            net: Number(r.inflow ?? 0) - Number(r.outflow ?? 0),
          };
        })
      );
    } catch (error) {
      setRows([]);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load institution activity.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const institutionOptions = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (r.institutionId) m.set(r.institutionId, r.institutionName || r.institutionId);
    });
    return Array.from(m.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterInstitution && r.institutionId !== filterInstitution) return false;
      const t = getBackendDateTime(r.date);
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
  }, [rows, filterInstitution, dateFrom, dateTo]);

  const columns = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (_v, row) => formatBackendDate(row.date),
    },
    { key: "institutionName", label: "Institution", sortable: true },
    {
      key: "inflow",
      label: "Inflow (NGN)",
      sortable: true,
      render: (v) => <span className="font-medium text-emerald-700">+{Number(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: "outflow",
      label: "Outflow (NGN)",
      sortable: true,
      render: (v) => <span className="font-medium text-rose-700">−{Number(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: "net",
      label: "Net (NGN)",
      sortable: true,
      render: (v) => {
        const n = Number(v ?? 0);
        return <span className={n >= 0 ? "text-emerald-800" : "text-rose-800"}>{n.toLocaleString()}</span>;
      },
    },
    { key: "transactionCount", label: "Txns", sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Institution wallet activity</h1>
          <p className="text-gray-500 mt-1">
            Aggregated inflow and outflow per financial institution and day (successful movements only in the demo data).
          </p>
        </div>
        <Button variant="outline" onClick={() => load()} disabled={isLoading} className="gap-2 shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 rounded-lg border bg-card p-5 sm:p-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Institution</Label>
          <Select value={filterInstitution || "__all__"} onValueChange={(v) => setFilterInstitution(v === "__all__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
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
          <Label htmlFor="inst-from">From date</Label>
          <input
            id="inst-from"
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inst-to">To date</Label>
          <input
            id="inst-to"
            type="date"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <DataTable data={filtered} columns={columns} isLoading={isLoading} emptyMessage="No aggregated rows match your filters." />
    </div>
  );
}
