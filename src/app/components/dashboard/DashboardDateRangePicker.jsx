"use client";

import { useEffect, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar, CALENDAR_YEAR_MIN, CALENDAR_YEAR_MAX } from "../ui/calendar";
import { cn } from "../ui/utils";
import { formatDashboardRangeLabel, normalizeDashboardDateRange } from "../../services/dashboards";

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

function getRangeForPreset(preset) {
  const ref = new Date();
  switch (preset) {
    case "all":
      return { start: startOfDay(new Date(2000, 0, 1)), end: endOfDay(ref) };
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
    default:
      return { start: startOfDay(ref), end: endOfDay(ref) };
  }
}

/**
 * Date range picker matching the Transactions page: preset list, then Custom
 * with two single calendars (dropdown month/year). Same `{ start, end }` API.
 *
 * @param {{ start: Date, end: Date }} value
 * @param {(range: { start: Date, end: Date }) => void} onChange
 */
export function DashboardDateRangePicker({
  value,
  onChange,
  id = "dashboard-date-range",
  label = "Date range",
  className = "",
  disableFuture = true,
}) {
  const applied = normalizeDashboardDateRange(value);
  const displayStart = startOfDay(applied.start);
  const displayEnd = endOfDay(applied.end);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("presets");
  const [customStart, setCustomStart] = useState(displayStart);
  const [customEnd, setCustomEnd] = useState(displayEnd);

  const maxDate = disableFuture ? endOfDay(new Date()) : undefined;

  useEffect(() => {
    if (!open) return;
    setView("presets");
    setCustomStart(startOfDay(applied.start));
    setCustomEnd(endOfDay(applied.end));
  }, [open, applied.start, applied.end]);

  const commitRange = (start, end) => {
    let nextStart = startOfDay(start);
    let nextEnd = endOfDay(end);
    if (nextStart.getTime() > nextEnd.getTime()) {
      const swap = nextStart;
      nextStart = startOfDay(nextEnd);
      nextEnd = endOfDay(swap);
    }
    if (maxDate && nextEnd.getTime() > maxDate.getTime()) {
      nextEnd = maxDate;
    }
    if (maxDate && nextStart.getTime() > maxDate.getTime()) {
      nextStart = startOfDay(maxDate);
      nextEnd = maxDate;
    }
    onChange(normalizeDashboardDateRange({ start: nextStart, end: nextEnd }));
    setOpen(false);
  };

  const applyPreset = (presetValue) => {
    if (presetValue === "custom") {
      setView("custom");
      setCustomStart(startOfDay(applied.start));
      setCustomEnd(endOfDay(applied.end));
      return;
    }
    const { start, end } = getRangeForPreset(presetValue);
    commitRange(start, end);
  };

  const applyCustom = () => {
    const start = customStart ? startOfDay(customStart) : displayStart;
    const end = customEnd ? endOfDay(customEnd) : displayEnd;
    commitRange(start, end);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            className="h-9 w-full justify-start gap-2 text-left font-normal sm:w-[min(100%,20rem)] lg:w-[18.5rem]"
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm">{formatDashboardRangeLabel({ start: displayStart, end: displayEnd })}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,42rem)] max-w-full p-0 sm:min-w-[320px]" align="end">
          {view === "custom" ? (
            <div className="space-y-4 p-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Start date</Label>
                  <Calendar
                    mode="single"
                    selected={customStart}
                    onSelect={(d) => d && setCustomStart(d)}
                    captionLayout="dropdown"
                    fromYear={CALENDAR_YEAR_MIN}
                    toYear={CALENDAR_YEAR_MAX}
                    toDate={maxDate}
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
                    toDate={maxDate}
                    defaultMonth={customEnd}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setView("presets")}>
                  Back
                </Button>
                <Button type="button" size="sm" className="flex-1" onClick={applyCustom}>
                  Apply
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Transactions from</p>
              <div className="flex flex-col gap-1">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applyPreset(preset.value)}
                    className="rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Compact read-only label helper for filter summaries. */
export function dashboardRangeSummary(range) {
  return formatDashboardRangeLabel(range);
}
