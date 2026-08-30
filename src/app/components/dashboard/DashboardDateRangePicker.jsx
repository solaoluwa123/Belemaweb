"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar, CALENDAR_YEAR_MIN, CALENDAR_YEAR_MAX } from "../ui/calendar";
import { formatDashboardRangeLabel, normalizeDashboardDateRange } from "../../services/dashboards";

/**
 * Start + end date picker for dashboard filters.
 * @param {{ start: Date, end: Date }} value
 * @param {(range: { start: Date, end: Date }) => void} onChange
 */
export function DashboardDateRangePicker({
  value,
  onChange,
  id = "dashboard-date-range",
  label = "Date range",
  className = "",
}) {
  const normalized = normalizeDashboardDateRange(value);
  const rangeLabel = formatDashboardRangeLabel(normalized);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{rangeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[17rem] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Calendar
            mode="range"
            selected={{ from: normalized.start, to: normalized.end }}
            onSelect={(next) => {
              if (!next?.from) return;
              const end = next.to ?? next.from;
              onChange(normalizeDashboardDateRange({ start: next.from, end }));
            }}
            defaultMonth={normalized.end}
            captionLayout="dropdown"
            fromYear={CALENDAR_YEAR_MIN}
            toYear={CALENDAR_YEAR_MAX}
            numberOfMonths={1}
            className="p-2"
            classNames={{
              months: "flex flex-col gap-2",
              month: "flex flex-col gap-2",
              caption: "min-h-7",
              caption_label: "text-xs font-medium",
              caption_dropdowns: "flex gap-1.5 items-center justify-center",
              dropdown_month:
                "h-7 px-2 min-w-[5.5rem] text-xs rounded-md border border-input bg-input-background",
              dropdown_year:
                "h-7 px-2 min-w-[4rem] text-xs rounded-md border border-input bg-input-background",
              nav_button: "size-6 p-0 opacity-70 hover:opacity-100",
              head_cell: "w-7 h-7 text-[0.65rem] font-medium p-0",
              cell: "w-7 min-w-[1.75rem] min-h-7 p-0 text-center",
              day: "size-7 p-0 text-xs font-normal rounded-md",
              row: "border-b border-border/40 last:border-b-0",
            }}
          />
          <p className="border-t px-2 py-1.5 text-[0.65rem] text-muted-foreground">
            Selected: {rangeLabel}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Compact read-only label helper for filter summaries. */
export function dashboardRangeSummary(range) {
  const { start, end } = normalizeDashboardDateRange(range);
  if (start.getTime() === end.getTime()) {
    return format(start, "MMM d, yyyy");
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}
