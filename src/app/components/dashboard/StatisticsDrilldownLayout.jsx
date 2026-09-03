"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { ArrowLeft, Download, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { cn } from "../ui/utils";
import { formatDashboardRangeLabel } from "../../services/dashboards";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { buildTransactionListLink } from "../../utils/dashboardFilterParams";
import { formatCountNg } from "../../utils/dashboardChartUtils";

function FilterChip({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

function downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => c.header).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = c.accessor(row);
          const s = String(val ?? "").replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatisticsDrilldownLayout({
  title,
  subtitle,
  dateRange,
  institution = "all",
  institutionLabel: institutionLabelOverride,
  isLoading,
  errorMessage,
  onRefresh,
  chart,
  tableColumns = [],
  tableRows = [],
  csvFilename = "export.csv",
  transactionLink,
  /** Top-level pages (reached from the sidebar) have nowhere to go "back" to. */
  showBack = true,
  /** Filter controls rendered in the action bar, e.g. date range and institution pickers. */
  controls,
  emptyMessage = "No data for this period.",
  children,
}) {
  const navigate = useNavigate();

  const rangeLabel = dateRange ? formatDashboardRangeLabel(dateRange) : "Last 7 days";
  const institutionLabel = useMemo(() => {
    if (institutionLabelOverride) return institutionLabelOverride;
    if (!institution || institution === "all") return "All institutions";
    return TRANSGATE_BANKS.find((b) => b.id === institution)?.name ?? institution;
  }, [institution, institutionLabelOverride]);

  const handleExport = () => {
    if (!tableRows.length || !tableColumns.length) return;
    downloadCsv(csvFilename, tableRows, tableColumns);
  };

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap justify-between gap-3",
          controls ? "items-end" : "items-center",
        )}
      >
        <div className={cn("flex flex-wrap gap-3", controls ? "items-end" : "items-center")}>
          {showBack ? (
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : null}
          {controls}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {transactionLink ? (
            <Button variant="outline" size="sm" onClick={() => navigate(transactionLink)} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View transactions
            </Button>
          ) : null}
          {tableRows.length > 0 && tableColumns.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
          <Button variant="outline" onClick={onRefresh} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label={rangeLabel} />
        <FilterChip label={institutionLabel} />
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </span>
            </div>
          ) : (
            <>
              {chart}
              {children}
              {tableColumns.length > 0 ? (
                <div className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--border)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tableColumns.map((col) => (
                          <TableHead key={col.header}>{col.header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={tableColumns.length}
                            className="py-8 text-center text-muted-foreground"
                          >
                            {emptyMessage}
                          </TableCell>
                        </TableRow>
                      ) : (
                        tableRows.map((row, i) => (
                          <TableRow key={row.id ?? row.code ?? row.channel ?? row.name ?? i}>
                            {tableColumns.map((col) => (
                              <TableCell key={col.header}>{col.cell ? col.cell(row) : col.accessor(row)}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { buildTransactionListLink, formatCountNg };
