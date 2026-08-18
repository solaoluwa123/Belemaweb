import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Eye, Loader2, RefreshCcw, Search, ScrollText } from "lucide-react";
import { DataTable } from "../../components/shared/DataTable";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import {
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  fetchAuditLogById,
  fetchAuditLogs,
} from "../../services/auditLogs";
import { formatBackendDateTime } from "../../utils/formatters";

function toApiDateStart(dateStr) {
  if (!dateStr) return "";
  return `${dateStr} 00:00:00`;
}

function toApiDateEnd(dateStr) {
  if (!dateStr) return "";
  return `${dateStr} 23:59:59`;
}

function OutcomeBadge({ outcome }) {
  const value = String(outcome || "").toUpperCase();
  const success = value === "SUCCESS";
  const failure = value === "FAILURE";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        success
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : failure
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {value || "—"}
    </span>
  );
}

function DetailRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default function AuditLogs() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ totalRecords: 0, page: 1, limit: 50 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    actor: "",
    action: "all",
    outcome: "all",
  });
  const [applied, setApplied] = useState(filters);

  const totalPages = Math.max(1, Math.ceil((meta.totalRecords || 0) / limit) || 1);
  const recordsFrom = meta.totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const recordsTo = Math.min(page * limit, meta.totalRecords || 0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const actor = String(applied.actor || "").trim();
      const result = await fetchAuditLogs({
        page,
        limit,
        startDate: toApiDateStart(applied.startDate),
        endDate: toApiDateEnd(applied.endDate),
        // Backend matches actor_email OR actor_username against this single value.
        email: actor,
        action: applied.action !== "all" ? applied.action : "",
        outcome: applied.outcome !== "all" ? applied.outcome : "",
      });
      setRows(result.rows);
      setMeta(result.meta);
    } catch (error) {
      setRows([]);
      setMeta({ totalRecords: 0, page, limit });
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  }, [applied, page, limit]);

  useEffect(() => {
    if (!isAdmin()) return;
    load();
  }, [isAdmin, load]);

  const openDetail = async (row) => {
    setDetailOpen(true);
    setDetailRow(row);
    setDetailLoading(true);
    try {
      const full = await fetchAuditLogById(row.id);
      if (full) setDetailRow(full);
    } catch {
      /* keep list row if detail fetch fails */
    } finally {
      setDetailLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const clearFilters = () => {
    const empty = {
      startDate: "",
      endDate: "",
      actor: "",
      action: "all",
      outcome: "all",
    };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  const columns = useMemo(
    () => [
      {
        key: "eventTime",
        label: "Time",
        sortable: true,
        render: (value) => formatBackendDateTime(value, { fallback: "—" }),
      },
      {
        key: "actor",
        label: "Actor",
        render: (_, row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{row.actorUsername || "—"}</p>
            <p className="truncate text-xs text-slate-500">{row.actorEmail || ""}</p>
          </div>
        ),
      },
      { key: "action", label: "Action", sortable: true },
      { key: "resource", label: "Resource", sortable: true, render: (v) => v || "—" },
      {
        key: "outcome",
        label: "Outcome",
        sortable: true,
        render: (value) => <OutcomeBadge outcome={value} />,
      },
      {
        key: "httpStatus",
        label: "Status",
        render: (value) => (value != null ? String(value) : "—"),
      },
      {
        key: "ipAddress",
        label: "IP",
        render: (value) => value || "—",
      },
      {
        key: "actions",
        label: "",
        render: (_, row) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={(e) => {
              e.stopPropagation();
              openDetail(row);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        ),
      },
    ],
    [],
  );

  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ScrollText className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Security and change events across the platform. Admin access only.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="audit-start">Start date</Label>
            <Input
              id="audit-start"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-end">End date</Label>
            <Input
              id="audit-end"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor">Actor (email or username)</Label>
            <Input
              id="audit-actor"
              placeholder="admin@belema.ng"
              value={filters.actor}
              onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select
              value={filters.action}
              onValueChange={(value) => setFilters((f) => ({ ...f, action: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {AUDIT_ACTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select
              value={filters.outcome}
              onValueChange={(value) => setFilters((f) => ({ ...f, outcome: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {AUDIT_OUTCOMES.map((outcome) => (
                  <SelectItem key={outcome} value={outcome}>
                    {outcome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={applyFilters} className="gap-2">
              <Search className="h-4 w-4" />
              Filter
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {isLoading
            ? "Loading…"
            : meta.totalRecords === 0
              ? "No audit events found"
              : `Showing ${recordsFrom}–${recordsTo} of ${meta.totalRecords.toLocaleString()}`}
          {applied.startDate || applied.endDate
            ? ` · ${applied.startDate || "…"} → ${applied.endDate || format(new Date(), "yyyy-MM-dd")}`
            : null}
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="audit-limit" className="text-sm text-slate-600">
            Per page
          </Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              setLimit(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger id="audit-limit" className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No audit log entries for this filter."
        initialPageSize={limit}
        onRowClick={openDetail}
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Audit event {detailRow?.id != null ? `#${detailRow.id}` : ""}</DialogTitle>
          </DialogHeader>
          {detailLoading && !detailRow ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          ) : detailRow ? (
            <dl className="space-y-3 py-2">
              <DetailRow
                label="Time"
                value={formatBackendDateTime(detailRow.eventTime, { fallback: detailRow.eventTime || "—" })}
              />
              <DetailRow label="Username" value={detailRow.actorUsername} />
              <DetailRow label="Email" value={detailRow.actorEmail} />
              <DetailRow
                label="Role id"
                value={detailRow.actorRole != null ? String(detailRow.actorRole) : ""}
              />
              <DetailRow label="Action" value={detailRow.action} />
              <DetailRow label="Resource" value={detailRow.resource} />
              <DetailRow label="HTTP method" value={detailRow.httpMethod} />
              <DetailRow label="Outcome" value={detailRow.outcome} />
              <DetailRow
                label="HTTP status"
                value={detailRow.httpStatus != null ? String(detailRow.httpStatus) : ""}
              />
              <DetailRow label="IP address" value={detailRow.ipAddress} />
              {detailRow.details ? (
                <div className="space-y-1.5">
                  <dt className="text-sm font-medium text-slate-500">Details</dt>
                  <dd>
                    <pre className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(detailRow.details), null, 2);
                        } catch {
                          return detailRow.details;
                        }
                      })()}
                    </pre>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="py-6 text-sm text-slate-600">No details available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
