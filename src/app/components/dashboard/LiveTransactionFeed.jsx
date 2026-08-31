import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Activity, Loader2, Pause, Play, Radio, RefreshCcw } from "lucide-react";
import { APIError } from "../../services/api";
import { fetchLiveTransactionFeed, LIVE_FEED_POLL_MS } from "../../services/dashboards";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { formatEmptyCell, getBackendDateTime, parseBackendDate } from "../../utils/formatters";

const MAX_ROWS = 200;

function formatFeedDateTime(value) {
  const parsed = parseBackendDate(value);
  if (!parsed) return formatEmptyCell(value);
  return parsed
    .toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function formatAmount(amount) {
  return `₦${Number(amount || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClassName(status) {
  if (status === "Successful") return "text-emerald-700 bg-emerald-50";
  if (status === "Pending") return "text-amber-700 bg-amber-50";
  if (status === "Reversed") return "text-violet-700 bg-violet-50";
  if (status === "Failed") return "text-rose-700 bg-rose-50";
  return "text-muted-foreground bg-muted";
}

function mergeFeedRows(existing, incoming, { prepend = false } = {}) {
  const seen = new Set(existing.map((row) => row.sessionId).filter(Boolean));
  const merged = prepend ? [...incoming, ...existing] : [...existing, ...incoming];
  const deduped = [];
  const ids = new Set();
  for (const row of merged) {
    const key = row.sessionId || row.id;
    if (!key || ids.has(key)) continue;
    ids.add(key);
    deduped.push(row);
    seen.add(key);
  }
  return deduped.slice(0, MAX_ROWS);
}

export function LiveTransactionFeed({ institutionCode: institutionCodeProp = null, showInstitutionFilter = true }) {
  const navigate = useNavigate();
  const { isAdmin, isThirdPartyVendor, user } = useAuth();
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [highlightIds, setHighlightIds] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const newestTimestampRef = useRef("");
  const loadSeq = useRef(0);
  const highlightTimers = useRef([]);

  const effectiveInstitution = useMemo(() => {
    if (institutionCodeProp) return institutionCodeProp;
    if (isThirdPartyVendor()) return user?.institutionCode || null;
    if (institutionFilter !== "all") return institutionFilter;
    if (!isAdmin()) return user?.institutionCode || null;
    return null;
  }, [institutionCodeProp, institutionFilter, isThirdPartyVendor, isAdmin, user?.institutionCode]);

  const markHighlights = useCallback((incomingRows) => {
    if (!incomingRows.length) return;
    const ids = incomingRows.map((row) => row.sessionId || row.id).filter(Boolean);
    if (!ids.length) return;

    setHighlightIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    const timer = window.setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 4000);
    highlightTimers.current.push(timer);
  }, []);

  const loadFeed = useCallback(
    async ({ silent = false, initial = false } = {}) => {
      const seq = ++loadSeq.current;
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage("");

      try {
        const since = initial ? undefined : newestTimestampRef.current || undefined;
        const { rows: incoming } = await fetchLiveTransactionFeed({
          since,
          limit: 50,
          institution: effectiveInstitution || undefined,
        });
        if (seq !== loadSeq.current) return;

        if (initial || !since) {
          const sorted = [...incoming].sort(
            (a, b) => getBackendDateTime(b.dateTime) - getBackendDateTime(a.dateTime),
          );
          setRows(sorted);
          if (sorted.length) {
            newestTimestampRef.current = sorted[0].dateTime || sorted[0].raw?.transactiondate || "";
          }
        } else if (incoming.length) {
          const sortedIncoming = [...incoming].sort(
            (a, b) => getBackendDateTime(b.dateTime) - getBackendDateTime(a.dateTime),
          );
          markHighlights(sortedIncoming);
          setRows((prev) => mergeFeedRows(prev, sortedIncoming, { prepend: true }));
          const newest = sortedIncoming[0];
          newestTimestampRef.current = newest.dateTime || newest.raw?.transactiondate || newestTimestampRef.current;
        }

        setLastUpdatedAt(new Date());
      } catch (error) {
        if (seq !== loadSeq.current) return;
        const message = error instanceof APIError ? error.message : "Unable to load live transactions.";
        if (!silent) {
          setRows([]);
        }
        setErrorMessage(message);
      } finally {
        if (seq !== loadSeq.current) return;
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [effectiveInstitution, markHighlights],
  );

  useEffect(() => {
    if (isThirdPartyVendor() && !user?.institutionCode) {
      setIsLoading(false);
      setErrorMessage("Your account is not linked to an institution.");
      return;
    }
    newestTimestampRef.current = "";
    loadFeed({ initial: true });
  }, [effectiveInstitution, user?.institutionCode, loadFeed, isThirdPartyVendor]);

  useEffect(() => {
    if (isPaused || isLoading || errorMessage) return undefined;
    const timer = window.setInterval(() => {
      loadFeed({ silent: true });
    }, LIVE_FEED_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, isLoading, errorMessage, loadFeed]);

  useEffect(
    () => () => {
      highlightTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const institutionLabel = useMemo(() => {
    if (isThirdPartyVendor()) return user?.institutionName || user?.institutionCode || "—";
    if (effectiveInstitution) {
      return TRANSGATE_BANKS.find((b) => b.id === effectiveInstitution)?.name ?? effectiveInstitution;
    }
    return "All institutions";
  }, [effectiveInstitution, isThirdPartyVendor, user?.institutionCode, user?.institutionName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Live Transaction Monitoring
            </h1>
            {!isPaused && !errorMessage ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CEF445]/40 bg-[#eef8c8] px-2.5 py-1 text-xs font-medium text-[#00411A]">
                <Radio className={`h-3 w-3 ${isRefreshing ? "animate-pulse" : "animate-pulse"}`} aria-hidden />
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Transactions as they arrive in the switch — polling every {LIVE_FEED_POLL_MS / 1000}s
            {isPaused ? " (paused)" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdatedAt ? (
            <p className="text-xs text-muted-foreground">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-card"
            onClick={() => setIsPaused((value) => !value)}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-card"
            onClick={() => {
              newestTimestampRef.current = "";
              loadFeed({ initial: true });
            }}
            disabled={isLoading}
          >
            {isLoading || isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-[color:var(--border)] bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Activity className="h-4 w-4 text-[#6B8E23]" />
                Live feed
              </CardTitle>
              <p className="text-xs text-muted-foreground">Scope: {institutionLabel}</p>
            </div>
            {showInstitutionFilter && !isThirdPartyVendor() && !institutionCodeProp ? (
              <div className="min-w-[220px] space-y-1.5">
                <Label htmlFor="live-feed-institution" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Institution
                </Label>
                <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                  <SelectTrigger id="live-feed-institution" className="bg-card">
                    <SelectValue placeholder="All institutions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All institutions</SelectItem>
                    {TRANSGATE_BANKS.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {errorMessage ? (
            <div className="mx-4 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading live transactions…
            </div>
          ) : null}

          {!isLoading && !errorMessage && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Activity className="h-8 w-8 text-[#CEF445]" />
              <p>No transactions yet. New rows will appear here automatically.</p>
            </div>
          ) : null}

          {!isLoading && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Session ID</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const rowKey = row.sessionId || row.id;
                    const isNew = highlightIds.has(rowKey);
                    return (
                      <TableRow
                        key={rowKey}
                        className={`cursor-pointer transition-colors ${isNew ? "bg-[#eef8c8]/80 animate-pulse" : "hover:bg-muted/50"}`}
                        onClick={() => {
                          if (row.sessionId) navigate(`/transactions/${row.sessionId}`);
                        }}
                      >
                        <TableCell className="whitespace-nowrap text-xs">{formatFeedDateTime(row.dateTime)}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">{formatEmptyCell(row.sessionId)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-medium">{formatAmount(row.amount)}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{formatEmptyCell(row.sourceBank)}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{formatEmptyCell(row.beneficiaryBank)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClassName(row.status)}`}>
                            {formatEmptyCell(row.status)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatEmptyCell(row.responseCode)}
                          {row.responseMessage ? ` · ${row.responseMessage}` : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
