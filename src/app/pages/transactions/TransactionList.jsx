import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Calendar, CALENDAR_YEAR_MIN, CALENDAR_YEAR_MAX } from "../../components/ui/calendar";
import { ChevronDown, Download, CalendarIcon, Filter, Loader2 } from "lucide-react";
import { APIError } from "../../services/api";
import {
  buildTransactionSearchParams,
  fetchTransactions,
  normalizeStreamTransaction,
  searchTransactions,
} from "../../services/transactions";
import { useLiveTransactionStream } from "../../hooks/useLiveTransactionStream";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { parseBackendDate, getBackendDateTime, formatEmptyCell } from "../../utils/formatters";
import { parseFilterDateParam } from "../../utils/dashboardFilterParams";

function formatDate(d) {
  const parsed = parseBackendDate(d);
  if (!parsed) return "empty";
  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", "");
}

function formatAmount(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "empty";
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

function formatDateRangeDisplay(start, end) {
  if (!start || !end) return "Select date range";
  return `${format(start, "MMMM d, yyyy h:mm a")} - ${format(end, "MMMM d, yyyy h:mm a")}`;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500];

const DATE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom" },
];

function getRefToday() {
  return new Date();
}

function getRangeForPreset(preset, customStart, customEnd) {
  const ref = getRefToday();
  switch (preset) {
    case "all":
      return { start: new Date(2000, 0, 1), end: endOfDay(ref) };
    case "today":
      return { start: startOfDay(ref), end: endOfDay(ref) };
    case "yesterday": {
      const d = subDays(ref, 1);
      return { start: startOfDay(d), end: endOfDay(d) };
    }
    case "last7":
      return { start: startOfDay(subDays(ref, 6)), end: endOfDay(ref) };
    case "last30":
      return { start: startOfDay(subDays(ref, 29)), end: endOfDay(ref) };
    case "thisMonth":
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    case "lastMonth": {
      const last = subMonths(ref, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    case "custom":
      return customStart && customEnd
        ? { start: startOfDay(customStart), end: endOfDay(customEnd) }
        : { start: startOfDay(ref), end: endOfDay(ref) };
    default:
      return { start: startOfDay(ref), end: endOfDay(ref) };
  }
}

const initialPreset = "today";
const initialRange = getRangeForPreset(initialPreset);

const ADVANCED_FILTERS_INITIAL = {
  status: "all",
  channel: "",
  sourceBank: "",
  beneficiaryBank: "",
  responseCode: "",
  sessionId: "",
  paymentRef: "",
  minAmount: "",
  maxAmount: "",
};

export default function TransactionList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, requiresInstitutionScope } = useAuth();
  const institutionCode = user?.institutionCode || "";
  const requireScope = requiresInstitutionScope();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [datePreset, setDatePreset] = useState(initialPreset);
  const [dateRangeStart, setDateRangeStart] = useState(initialRange.start);
  const [dateRangeEnd, setDateRangeEnd] = useState(initialRange.end);
  const [customStart, setCustomStart] = useState(initialRange.start);
  const [customEnd, setCustomEnd] = useState(initialRange.end);
  /** Values that drive the transaction list (updated when user clicks Filter). */
  const [advancedFiltersApplied, setAdvancedFiltersApplied] = useState(ADVANCED_FILTERS_INITIAL);
  /** Editable fields in the overlay (updated on Clear / when opening panel). */
  const [advancedFiltersDraft, setAdvancedFiltersDraft] = useState(ADVANCED_FILTERS_INITIAL);
  const [liveHighlightIds, setLiveHighlightIds] = useState(() => new Set());
  const highlightTimersRef = useRef([]);
  const urlFiltersInitialized = useRef(false);

  useEffect(() => {
    if (urlFiltersInitialized.current) return;
    const responseCode = searchParams.get("responseCode");
    const status = searchParams.get("status");
    const urlInstitution = searchParams.get("institution");
    const from = parseFilterDateParam(searchParams.get("from"));
    const to = parseFilterDateParam(searchParams.get("to"));
    let nextFilters = { ...ADVANCED_FILTERS_INITIAL };
    if (responseCode) {
      nextFilters = { ...nextFilters, responseCode };
      setFiltersOpen(true);
    }
    if (status && ["all", "successful", "pending", "failed"].includes(status.toLowerCase())) {
      nextFilters = { ...nextFilters, status: status.toLowerCase() };
      setFiltersOpen(true);
    }
    if (urlInstitution && !requireScope) {
      nextFilters = { ...nextFilters, sourceBank: urlInstitution };
    }
    if (responseCode || status || urlInstitution) {
      setAdvancedFiltersApplied(nextFilters);
      setAdvancedFiltersDraft(nextFilters);
    }
    if (from && to) {
      setDatePreset("custom");
      const start = startOfDay(from);
      const end = endOfDay(to);
      setDateRangeStart(start);
      setDateRangeEnd(end);
      setCustomStart(start);
      setCustomEnd(end);
    }
    urlFiltersInitialized.current = true;
  }, [searchParams]);

  const isLiveRange = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    return dateRangeEnd.getTime() >= todayStart;
  }, [dateRangeEnd]);

  const streamInstitution = requireScope ? institutionCode || null : null;
  const advancedFiltersActive = useMemo(() => {
    return Object.entries(advancedFiltersApplied).some(([key, v]) => {
      if (key === "status") return v !== "all";
      return String(v || "").trim() !== "";
    });
  }, [advancedFiltersApplied]);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (advancedFiltersActive) {
        try {
          const params = await buildTransactionSearchParams({
            userInstitutionCode: institutionCode,
            startDate: dateRangeStart,
            endDate: dateRangeEnd,
            page: 1,
            limit: 2000,
            advanced: advancedFiltersApplied,
          });
          const data = await searchTransactions(params, {
            requireInstitutionScope: requireScope,
            clientFilters: advancedFiltersApplied,
          });
          setTransactions(data);
        } catch (searchErr) {
          const data = await fetchTransactions({
            institutionCode,
            requireInstitutionScope: requireScope,
          });
          setTransactions(data);
          setErrorMessage(
            searchErr instanceof APIError
              ? `${searchErr.message} Showing full list with client-side filters only.`
              : "Transaction search failed; showing full list.",
          );
        }
      } else {
        const data = await fetchTransactions({
          institutionCode,
          requireInstitutionScope: requireScope,
        });
        setTransactions(data);
      }
    } catch (error) {
      const message =
        error instanceof APIError && error.status === 401
          ? error.message ||
            "Your session is not authorized for transactions. Sign in with a valid backend account and try again."
          : error instanceof APIError
            ? error.message
            : "Unable to load transactions right now.";
      setTransactions([]);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    advancedFiltersActive,
    advancedFiltersApplied,
    dateRangeEnd,
    dateRangeStart,
    institutionCode,
    requireScope,
  ]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleStreamTransaction = useCallback(
    async (rawRow) => {
      try {
        const row = await normalizeStreamTransaction(rawRow);
        const t = getBackendDateTime(row.dateTime);
        if (t < dateRangeStart.getTime() || t > dateRangeEnd.getTime()) return;

        setTransactions((prev) => {
          if (prev.some((item) => item.sessionId && item.sessionId === row.sessionId)) {
            return prev;
          }
          return [row, ...prev];
        });

        const key = row.sessionId || row.id;
        if (!key) return;
        setLiveHighlightIds((prev) => new Set(prev).add(key));
        const timer = window.setTimeout(() => {
          setLiveHighlightIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 4000);
        highlightTimersRef.current.push(timer);
      } catch {
        /* ignore bad stream payload */
      }
    },
    [dateRangeEnd, dateRangeStart],
  );

  useLiveTransactionStream({
    institution: streamInstitution || undefined,
    enabled: isLiveRange && !advancedFiltersActive && !isLoading,
    onTransaction: handleStreamTransaction,
  });

  useEffect(
    () => () => {
      highlightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const channelOptions = useMemo(() => {
    const set = new Set();
    for (const row of transactions) {
      const c = String(row.channelCode || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const sourceBankOptions = useMemo(() => {
    const set = new Set();
    for (const row of transactions) {
      const c = String(row.sourceBank || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const beneficiaryBankOptions = useMemo(() => {
    const set = new Set();
    for (const row of transactions) {
      const c = String(row.beneficiaryBank || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    const start = dateRangeStart.getTime();
    const end = dateRangeEnd.getTime();
    const q = searchQuery.toLowerCase().trim();
    const {
      status: advStatus,
      channel: advChannel,
      sourceBank: advSourceBank,
      beneficiaryBank: advBeneficiaryBank,
      responseCode: advResponseCode,
      sessionId: advSessionId,
      paymentRef: advPaymentRef,
      minAmount: advMin,
      maxAmount: advMax,
    } = advancedFiltersApplied;

    const minN = advMin.trim() === "" ? null : Number(advMin.replace(/,/g, ""));
    const maxN = advMax.trim() === "" ? null : Number(advMax.replace(/,/g, ""));
    const minOk = minN === null || Number.isFinite(minN);
    const maxOk = maxN === null || Number.isFinite(maxN);

    list = list.filter((row) => {
      const t = getBackendDateTime(row.dateTime);
      if (!t) return false;
      if (t < start || t > end) return false;

      if (!advancedFiltersActive) {
        if (advStatus !== "all" && String(row.status || "") !== advStatus) return false;

        if (advChannel.trim()) {
          const ch = (row.channelCode || "").toLowerCase();
          if (!ch.includes(advChannel.toLowerCase().trim())) return false;
        }
        if (advSourceBank.trim()) {
          const b = (row.sourceBank || "").toLowerCase();
          if (!b.includes(advSourceBank.toLowerCase().trim())) return false;
        }
        if (advBeneficiaryBank.trim()) {
          const b = (row.beneficiaryBank || "").toLowerCase();
          if (!b.includes(advBeneficiaryBank.toLowerCase().trim())) return false;
        }
        if (advResponseCode.trim()) {
          const rc = (row.responseCode || "").toLowerCase();
          if (!rc.includes(advResponseCode.toLowerCase().trim())) return false;
        }
        if (advSessionId.trim()) {
          const sid = (row.sessionId || "").toLowerCase();
          if (!sid.includes(advSessionId.toLowerCase().trim())) return false;
        }
        if (advPaymentRef.trim()) {
          const pr = (row.paymentReferenceNo || "").toLowerCase();
          if (!pr.includes(advPaymentRef.toLowerCase().trim())) return false;
        }

        const amt = Number(row.amount) || 0;
        if (minOk && minN !== null && amt < minN) return false;
        if (maxOk && maxN !== null && amt > maxN) return false;
      }

      if (!q) return true;
      const sessionId = (row.sessionId || "").toLowerCase();
      const paymentRef = (row.paymentReferenceNo || "").toLowerCase();
      const channel = (row.channelCode || "").toLowerCase();
      const status = (row.status || "").toLowerCase();
      const parsedDate = parseBackendDate(row.dateTime);
      const dateStr = parsedDate ? format(parsedDate, "PPpp").toLowerCase() : "";
      const source = (row.sourceAccountName || "").toLowerCase();
      const beneficiary = (row.beneficiaryAccountName || "").toLowerCase();
      const responseCode = (row.responseCode || "").toLowerCase();
      const responseMsg = (row.responseMessage || "").toLowerCase();
      return (
        sessionId.includes(q) ||
        paymentRef.includes(q) ||
        channel.includes(q) ||
        status.includes(q) ||
        responseCode.includes(q) ||
        responseMsg.includes(q) ||
        dateStr.includes(q) ||
        source.includes(q) ||
        beneficiary.includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const ta = getBackendDateTime(a.dateTime);
      const tb = getBackendDateTime(b.dateTime);
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return tb - ta;
    });
  }, [transactions, dateRangeStart, dateRangeEnd, searchQuery, advancedFiltersApplied, advancedFiltersActive]);

  const totalCount = filteredTransactions.length;
  const totalValue = useMemo(
    () => filteredTransactions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [filteredTransactions]
  );
  const successCount = useMemo(
    () => filteredTransactions.filter((r) => r.status === "Successful").length,
    [filteredTransactions]
  );
  const successRate = totalCount ? ((successCount / totalCount) * 100).toFixed(2) : "0.00";

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedRows = useMemo(
    () => filteredTransactions.slice((page - 1) * pageSize, page * pageSize),
    [filteredTransactions, page, pageSize]
  );
  const recordsFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const recordsTo = Math.min(page * pageSize, totalCount);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, dateRangeStart, dateRangeEnd, pageSize, advancedFiltersApplied]);

  const handleDownload = () => {
    const rows = [
      [
        "Session ID",
        "Payment Reference",
        "Channel Code",
        "Source Account Name",
        "Source Bank",
        "Beneficiary Account Name",
        "Beneficiary Bank",
        "Destination Node",
        "Amount",
        "Status",
        "Response Code",
        "Response Message",
        "FT Duration (ms)",
        "Date/Time",
      ].join(","),
      ...filteredTransactions.map((row) =>
        [
          row.sessionId,
          row.paymentReferenceNo,
          row.channelCode,
          row.sourceAccountName,
          row.sourceBank,
          row.beneficiaryAccountName,
          row.beneficiaryBank,
          row.destinationNode,
          row.amount,
          row.status,
          row.responseCode,
          row.responseMessage,
          row.ftDurationMs,
          row.dateTime,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const downloadReceipt = useMemo(() => {
    return (row) => {
      const content = [
        "Transaction Receipt",
        "-------------------",
        `Session ID: ${row.sessionId}`,
        `Payment Reference: ${row.paymentReferenceNo}`,
        `Channel: ${row.channelCode}`,
        `Source Account Name: ${row.sourceAccountName}`,
        `Source Bank: ${row.sourceBank}`,
        `Beneficiary Account Name: ${row.beneficiaryAccountName}`,
        `Beneficiary Bank: ${row.beneficiaryBank}`,
        `Destination Node: ${row.destinationNode}`,
        `Amount: ${formatAmount(row.amount)}`,
        `Status: ${row.status}`,
        `Response Code: ${row.responseCode || "–"}`,
        `Response Message: ${row.responseMessage || "–"}`,
        `FT Duration: ${formatDuration(row.ftDurationMs)}`,
        `Date/Time: ${formatDate(row.dateTime)}`,
      ].join("\n");

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.paymentReferenceNo || row.sessionId || "receipt"}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };
  }, []);

  const updateAdvancedDraft = (patch) => {
    setAdvancedFiltersDraft((prev) => ({ ...prev, ...patch }));
  };

  const openAdvancedFilters = () => {
    setAdvancedFiltersDraft({ ...advancedFiltersApplied });
    setFiltersOpen(true);
  };

  return (
    <div className="relative space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {/* Title, KPIs, and date/actions on one horizontal band */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <h1 className="shrink-0 text-lg font-bold uppercase tracking-tight text-slate-900 sm:text-xl">
              Total Transactions
            </h1>
            <div className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
              
              <span>
                Count: <strong className="text-slate-900">{totalCount.toLocaleString()}</strong>
              </span>
              <span>
                Value: <strong className="text-slate-900">{formatAmount(totalValue)}</strong>
              </span>
              <span>
                Success: <strong className="text-green-600">{successRate}%</strong>
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-full justify-start gap-2 text-left font-normal sm:w-[min(100%,20rem)] lg:w-[18.5rem]"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm">
                    {formatDateRangeDisplay(dateRangeStart, dateRangeEnd)}
                  </span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
            <PopoverContent className="w-[min(100vw-2rem,42rem)] max-w-full p-0 sm:min-w-[320px]" align="end">
              {datePreset === "custom" ? (
                <div className="p-3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Start date</Label>
                      <Calendar
                        mode="single"
                        selected={customStart}
                        onSelect={(d) => d && setCustomStart(d)}
                        captionLayout="dropdown"
                        fromYear={CALENDAR_YEAR_MIN}
                        toYear={CALENDAR_YEAR_MAX}
                        defaultMonth={customStart}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">End date</Label>
                      <Calendar
                        mode="single"
                        selected={customEnd}
                        onSelect={(d) => d && setCustomEnd(d)}
                        captionLayout="dropdown"
                        fromYear={CALENDAR_YEAR_MIN}
                        toYear={CALENDAR_YEAR_MAX}
                        defaultMonth={customEnd}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDatePreset("last7")}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const start = customStart ? startOfDay(customStart) : dateRangeStart;
                        const end = customEnd ? endOfDay(customEnd) : dateRangeEnd;
                        setDateRangeStart(start);
                        setDateRangeEnd(end);
                        setDateRangeOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Transactions from</p>
                  <div className="flex flex-col gap-1">
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          if (preset.value === "custom") {
                            setDatePreset("custom");
                            setCustomStart(dateRangeStart);
                            setCustomEnd(dateRangeEnd);
                          } else {
                            const { start, end } = getRangeForPreset(preset.value);
                            setDateRangeStart(start);
                            setDateRangeEnd(end);
                            setDatePreset(preset.value);
                            setDateRangeOpen(false);
                          }
                        }}
                        className="text-left text-sm py-1.5 px-2 rounded hover:bg-slate-100 text-slate-700"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
            <Button
              size="sm"
              className="h-9 shrink-0"
              disabled={filteredTransactions.length === 0}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-black">Entries</span>
            <span className="ml-1 text-sm text-black" aria-live="polite">
              · {totalCount ? `${recordsFrom}–${recordsTo} of ${totalCount}` : "0 rows"}
            </span>
          </div>
          <div className="flex w-full flex-row flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <Button
              type="button"
              variant={filtersOpen || advancedFiltersActive ? "secondary" : "outline"}
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              onClick={() => {
                if (filtersOpen) return;
                openAdvancedFilters();
              }}
            >
              <Filter className="h-4 w-4" />
              Advanced filters
              {advancedFiltersActive ? (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">On</span>
              ) : null}
            </Button>
            <Label htmlFor="quick-search" className="sr-only">
              Quick search
            </Label>
            <Input
              id="quick-search"
              type="search"
              placeholder="Quick search: session ID, reference, names, status…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 min-w-[12rem] flex-1 sm:w-72 sm:flex-none md:w-80"
            />
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {filtersOpen ? (
        <>
          <div
            className="fixed top-0 left-0 w-full h-full inset-0 z-[90] bg-black/70"
            aria-hidden
          />
          <div
            className="fixed top-0 right-0 z-[100] flex h-[100dvh] max-h-[100dvh] w-[min(100vw,24rem)] flex-col rounded-none border-l border-slate-200 bg-slate-50 shadow-xl ring-1 ring-white/10 sm:max-w-md sm:rounded-l-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adv-filters-title"
          >
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
          <div className="mb-3 shrink-0">
            <p id="adv-filters-title" className="text-sm font-medium text-slate-800">
              Advanced filters
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="adv-status">Status</Label>
              <Select value={advancedFiltersDraft.status} onValueChange={(v) => updateAdvancedDraft({ status: v })}>
                <SelectTrigger id="adv-status" className="h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Successful">Successful</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Reversed">Reversed</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-channel">Channel code</Label>
              <Input
                id="adv-channel"
                list="txn-channel-datalist"
                placeholder="Contains…"
                className="h-9"
                value={advancedFiltersDraft.channel}
                onChange={(e) => updateAdvancedDraft({ channel: e.target.value })}
              />
              <datalist id="txn-channel-datalist">
                {channelOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-rc">Response code</Label>
              <Input
                id="adv-rc"
                placeholder="Contains…"
                className="h-9"
                value={advancedFiltersDraft.responseCode}
                onChange={(e) => updateAdvancedDraft({ responseCode: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-src-bank">Source bank</Label>
              <Input
                id="adv-src-bank"
                list="txn-src-bank-datalist"
                placeholder="Contains…"
                className="h-9"
                value={advancedFiltersDraft.sourceBank}
                onChange={(e) => updateAdvancedDraft({ sourceBank: e.target.value })}
              />
              <datalist id="txn-src-bank-datalist">
                {sourceBankOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-ben-bank">Beneficiary bank</Label>
              <Input
                id="adv-ben-bank"
                list="txn-ben-bank-datalist"
                placeholder="Contains…"
                className="h-9"
                value={advancedFiltersDraft.beneficiaryBank}
                onChange={(e) => updateAdvancedDraft({ beneficiaryBank: e.target.value })}
              />
              <datalist id="txn-ben-bank-datalist">
                {beneficiaryBankOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-session">Session ID</Label>
              <Input
                id="adv-session"
                placeholder="Contains…"
                className="h-9 font-mono text-sm"
                value={advancedFiltersDraft.sessionId}
                onChange={(e) => updateAdvancedDraft({ sessionId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-payref">Payment reference</Label>
              <Input
                id="adv-payref"
                placeholder="Contains…"
                className="h-9 font-mono text-sm"
                value={advancedFiltersDraft.paymentRef}
                onChange={(e) => updateAdvancedDraft({ paymentRef: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-min-amt">Min amount (₦)</Label>
              <Input
                id="adv-min-amt"
                inputMode="decimal"
                placeholder="Optional"
                className="h-9"
                value={advancedFiltersDraft.minAmount}
                onChange={(e) => updateAdvancedDraft({ minAmount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-max-amt">Max amount (₦)</Label>
              <Input
                id="adv-max-amt"
                inputMode="decimal"
                placeholder="Optional"
                className="h-9"
                value={advancedFiltersDraft.maxAmount}
                onChange={(e) => updateAdvancedDraft({ maxAmount: e.target.value })}
              />
            </div>
          </div>
          <p className="mt-3 shrink-0 text-sm leading-5 text-slate-700">
            Set the fields above, then click <strong className="font-semibold text-slate-900">Filter</strong> to update
            the list. Date range and quick search still apply immediately. Text fields use &quot;contains&quot; matching.
          </p>
          <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-nowrap sm:justify-end sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full font-semibold uppercase tracking-wide sm:order-1 sm:w-auto"
              onClick={() => setAdvancedFiltersDraft({ ...ADVANCED_FILTERS_INITIAL })}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full font-semibold uppercase tracking-wide sm:order-2 sm:w-auto"
              onClick={() => setFiltersOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="h-10 w-full font-semibold uppercase tracking-wide sm:order-3 sm:w-auto"
              onClick={() => setAdvancedFiltersApplied({ ...advancedFiltersDraft })}
            >
              Filter
            </Button>
          </div>
          </div>
          </div>
        </>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">S/N</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Session ID</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Channel Code</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Source Account Name</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Source Bank</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Beneficiary Account Name</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Beneficiary Bank</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Destination Node</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Amount</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Status</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Response code</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap min-w-[140px]">Response message</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">FT duration</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Date/Time</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Payment reference No</TableHead>
              <TableHead className="font-semibold text-slate-900 whitespace-nowrap">More</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={16} className="py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading transactions...
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="py-10 text-center text-slate-500">
                  No transactions found for the current filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={`hover:bg-slate-50 ${liveHighlightIds.has(row.sessionId || row.id) ? "bg-[#eef8c8]/80" : ""}`}
                >
                  <TableCell className="text-slate-700">{recordsFrom + idx}</TableCell>
                  <TableCell className="text-slate-800 font-mono text-xs whitespace-nowrap">{formatEmptyCell(row.sessionId)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.channelCode)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.sourceAccountName)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.sourceBank)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.beneficiaryAccountName)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.beneficiaryBank)}</TableCell>
                  <TableCell className="text-slate-800 whitespace-nowrap">{formatEmptyCell(row.destinationNode)}</TableCell>
                  <TableCell className="text-slate-800 font-medium whitespace-nowrap">{formatAmount(row.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={
                        row.status === "Successful"
                          ? "text-green-600 font-medium"
                          : row.status === "Pending"
                            ? "text-cyan-600 font-medium"
                            : row.status === "Reversed"
                              ? "text-amber-600 font-medium"
                              : "text-red-600 font-medium"
                      }
                    >
                      {formatEmptyCell(row.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-800 font-mono text-xs whitespace-nowrap">{formatEmptyCell(row.responseCode)}</TableCell>
                  <TableCell className="text-slate-700 text-xs max-w-[220px] truncate" title={formatEmptyCell(row.responseMessage)}>
                    {formatEmptyCell(row.responseMessage)}
                  </TableCell>
                  <TableCell className="text-slate-700 whitespace-nowrap">{formatDuration(row.ftDurationMs)}</TableCell>
                  <TableCell className="text-slate-700 text-sm whitespace-nowrap">{formatDate(row.dateTime)}</TableCell>
                  <TableCell className="text-slate-800 font-mono text-xs whitespace-nowrap">{formatEmptyCell(row.paymentReferenceNo)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/transactions/${encodeURIComponent(row.sessionId || row.id)}`)}
                        className="text-primary hover:text-[var(--primary-hover)] hover:underline text-sm font-medium"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadReceipt(row)}
                        className="text-primary hover:text-[var(--primary-hover)] hover:underline text-sm font-medium"
                      >
                        Download receipt
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {recordsFrom} – {recordsTo} of {totalCount}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
