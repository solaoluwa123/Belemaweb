"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarIcon, Check, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar, CALENDAR_YEAR_MIN } from "../ui/calendar";
import { cn } from "../ui/utils";
import { formatDashboardRangeLabel, normalizeDashboardDateRange } from "../../services/dashboards";

const INPUT_FORMAT = "yyyy-MM-dd";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Relative ranges resolved at open time so "Today" is never stale. */
function buildPresets(today) {
  const lastMonth = subMonths(today, 1);
  return [
    { id: "today", label: "Today", start: today, end: today },
    { id: "yesterday", label: "Yesterday", start: subDays(today, 1), end: subDays(today, 1) },
    { id: "last7", label: "Last 7 days", start: subDays(today, 6), end: today },
    { id: "last30", label: "Last 30 days", start: subDays(today, 29), end: today },
    { id: "last90", label: "Last 90 days", start: subDays(today, 89), end: today },
    { id: "thisMonth", label: "This month", start: startOfMonth(today), end: today },
    {
      id: "lastMonth",
      label: "Last month",
      start: startOfMonth(lastMonth),
      end: endOfMonth(lastMonth),
    },
    { id: "thisQuarter", label: "This quarter", start: startOfQuarter(today), end: today },
    { id: "ytd", label: "Year to date", start: startOfYear(today), end: today },
  ];
}

function sameDay(a, b) {
  return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
}

function toInputValue(date) {
  return date instanceof Date && isValid(date) ? format(date, INPUT_FORMAT) : "";
}

function fromInputValue(text) {
  const parsed = parse(String(text || ""), INPUT_FORMAT, new Date());
  if (!isValid(parsed)) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function useIsWideViewport() {
  const [isWide, setIsWide] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 700px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia("(min-width: 700px)");
    const onChange = (event) => setIsWide(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isWide;
}

/**
 * Enterprise date range picker: quick presets, dual-month calendar, typed entry,
 * and staged Apply/Cancel so a partial selection never triggers a data fetch.
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
  const isWide = useIsWideViewport();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: applied.start, to: applied.end });
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(applied.end));
  const [startText, setStartText] = useState(() => toInputValue(applied.start));
  const [endText, setEndText] = useState(() => toInputValue(applied.end));

  const today = useMemo(() => startOfToday(), [open]);
  const presets = useMemo(() => buildPresets(today), [today]);
  const maxDate = disableFuture ? today : undefined;
  const minDate = useMemo(() => new Date(CALENDAR_YEAR_MIN, 0, 1), []);

  const monthCount = isWide ? 2 : 1;

  /** Re-seed the draft whenever the popover opens so Cancel is lossless. */
  useEffect(() => {
    if (!open) return;
    setDraft({ from: applied.start, to: applied.end });
    setStartText(toInputValue(applied.start));
    setEndText(toInputValue(applied.end));
    const anchor = startOfMonth(applied.end);
    setVisibleMonth(monthCount === 2 ? subMonths(anchor, 1) : anchor);
  }, [open]);

  const draftStart = draft.from ?? null;
  const draftEnd = draft.to ?? draft.from ?? null;
  const dayCount =
    draftStart && draftEnd ? differenceInCalendarDays(draftEnd, draftStart) + 1 : 0;
  const awaitingEnd = Boolean(draft.from && !draft.to);

  const activePresetId = useMemo(() => {
    if (!draftStart || !draftEnd) return null;
    const match = presets.find((p) => sameDay(p.start, draftStart) && sameDay(p.end, draftEnd));
    return match?.id ?? null;
  }, [draftStart, draftEnd, presets]);

  const appliedLabel = formatDashboardRangeLabel(applied);
  const appliedDays = differenceInCalendarDays(applied.end, applied.start) + 1;

  const commit = (range) => {
    const next = normalizeDashboardDateRange({ start: range.from, end: range.to ?? range.from });
    onChange(next);
    setOpen(false);
  };

  const applyPreset = (preset) => {
    setDraft({ from: preset.start, to: preset.end });
    setStartText(toInputValue(preset.start));
    setEndText(toInputValue(preset.end));
    commit({ from: preset.start, to: preset.end });
  };

  const handleCalendarSelect = (next) => {
    // Clicking a completed range restarts selection from that day.
    if (!next?.from) {
      setDraft({ from: undefined, to: undefined });
      setStartText("");
      setEndText("");
      return;
    }
    setDraft(next);
    setStartText(toInputValue(next.from));
    setEndText(toInputValue(next.to ?? next.from));
  };

  const handleTypedDate = (which, text) => {
    if (which === "start") setStartText(text);
    else setEndText(text);

    const parsed = fromInputValue(text);
    if (!parsed) return;
    if (maxDate && parsed.getTime() > maxDate.getTime()) return;
    if (parsed.getTime() < minDate.getTime()) return;

    const nextFrom = which === "start" ? parsed : draftStart;
    const nextTo = which === "end" ? parsed : draftEnd;
    if (!nextFrom || !nextTo) return;

    const ordered =
      nextFrom.getTime() <= nextTo.getTime()
        ? { from: nextFrom, to: nextTo }
        : { from: nextTo, to: nextFrom };
    setDraft(ordered);
    setVisibleMonth(startOfMonth(which === "start" ? ordered.from : ordered.to));
  };

  const yearOptions = useMemo(() => {
    const maxYear = (maxDate ?? new Date()).getFullYear();
    const years = [];
    for (let y = maxYear; y >= maxYear - 12; y -= 1) years.push(y);
    return years;
  }, [maxDate]);

  const jumpTo = (nextMonthIndex, nextYear) => {
    let target = new Date(nextYear, nextMonthIndex, 1);
    if (maxDate && target.getTime() > startOfMonth(maxDate).getTime()) {
      target = startOfMonth(maxDate);
    }
    setVisibleMonth(monthCount === 2 ? subMonths(target, monthCount - 1) : target);
  };

  const navMonth = monthCount === 2 ? addMonths(visibleMonth, 1) : visibleMonth;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            aria-label={`${label}: ${appliedLabel}`}
            className="w-full justify-start bg-card text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{appliedLabel}</span>
            <span className="ml-auto hidden shrink-0 items-center gap-1.5 pl-2 sm:flex">
              <span className="rounded-full bg-[#eef8c8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#00411A]">
                {appliedDays}d
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col sm:flex-row">
            <div className="border-b border-border bg-muted/40 p-2 sm:w-[9.5rem] sm:border-b-0 sm:border-r">
              <p className="px-2 pb-1.5 pt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick ranges
              </p>
              <div className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
                {presets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex shrink-0 items-center justify-between gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                        isActive
                          ? "bg-[#00411A] text-white"
                          : "text-foreground hover:bg-[#eef8c8] hover:text-[#00411A]",
                      )}
                    >
                      {preset.label}
                      {isActive ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <select
                  aria-label="Jump to month"
                  value={navMonth.getMonth()}
                  onChange={(e) => jumpTo(Number(e.target.value), navMonth.getFullYear())}
                  className="h-8 rounded-md border border-input bg-input-background px-2 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Jump to year"
                  value={navMonth.getFullYear()}
                  onChange={(e) => jumpTo(navMonth.getMonth(), Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-input-background px-2 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                    awaitingEnd
                      ? "bg-[#fff0eb] text-[#E84A25]"
                      : "bg-[#eef8c8] text-[#00411A]",
                  )}
                >
                  {awaitingEnd ? "Pick end date" : `${dayCount} day${dayCount === 1 ? "" : "s"}`}
                </span>
              </div>

              <Calendar
                mode="range"
                selected={{ from: draft.from, to: draft.to }}
                onSelect={handleCalendarSelect}
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                numberOfMonths={monthCount}
                fromDate={minDate}
                toDate={maxDate}
                className="p-3"
                classNames={{
                  months: "flex flex-col sm:flex-row gap-5",
                  month: "flex flex-col gap-3",
                  caption: "flex justify-center pt-0 relative items-center w-full min-h-8",
                  caption_label: "text-xs font-semibold text-foreground",
                  nav: "flex items-center gap-1",
                  nav_button:
                    "inline-flex size-7 items-center justify-center rounded-md border border-input bg-card text-foreground opacity-70 transition-colors hover:bg-[#eef8c8] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                  head_cell:
                    "w-8 h-8 p-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground",
                  cell: "w-8 min-w-[2rem] min-h-8 p-0 text-center align-middle",
                  day: "inline-flex size-8 items-center justify-center rounded-md p-0 text-xs font-normal transition-colors [&:not([aria-selected])]:hover:bg-[#eef8c8] [&:not([aria-selected])]:hover:text-[#00411A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                  day_selected: "bg-[#00411A] text-white",
                  day_range_start: "day-range-start bg-[#00411A] text-white",
                  day_range_end: "day-range-end bg-[#00411A] text-white",
                  day_range_middle: "aria-selected:bg-[#eef8c8] aria-selected:text-[#00411A]",
                  day_today: "ring-1 ring-inset ring-[#CEF445] font-semibold",
                  row: "",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`${id}-start`} className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  From
                </Label>
                <Input
                  id={`${id}-start`}
                  type="date"
                  value={startText}
                  max={toInputValue(maxDate) || undefined}
                  min={toInputValue(minDate)}
                  onChange={(e) => handleTypedDate("start", e.target.value)}
                  className="h-8 w-[8.5rem] bg-card text-xs"
                />
              </div>
              <span className="pb-2 text-muted-foreground">–</span>
              <div className="space-y-1">
                <Label htmlFor={`${id}-end`} className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  To
                </Label>
                <Input
                  id={`${id}-end`}
                  type="date"
                  value={endText}
                  max={toInputValue(maxDate) || undefined}
                  min={toInputValue(minDate)}
                  onChange={(e) => handleTypedDate("end", e.target.value)}
                  className="h-8 w-[8.5rem] bg-card text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-8 bg-card px-3 text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => draftStart && commit({ from: draftStart, to: draftEnd })}
                disabled={!draftStart}
                className="h-8 px-4 text-xs"
              >
                Apply
              </Button>
            </div>
          </div>
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
