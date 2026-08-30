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
        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
            numberOfMonths={2}
          />
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
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
