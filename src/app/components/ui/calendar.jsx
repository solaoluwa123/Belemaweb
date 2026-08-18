"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

/** Enterprise year range for date dropdowns (single source of truth). */
export const CALENDAR_YEAR_MIN = 1990;
export const CALENDAR_YEAR_MAX = 2100;

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  fixedWeeks = true,
  weekStartsOn = 1,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      weekStartsOn={weekStartsOn}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-0 relative items-center w-full min-h-9",
        caption_label: "text-sm font-medium text-foreground",
        caption_dropdowns: "flex gap-3 items-center justify-center",
        dropdown_month:
          "relative inline-flex items-center rounded-md border border-input bg-input-background h-9 px-3 min-w-[7.5rem] text-sm font-normal text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        dropdown_year:
          "relative inline-flex items-center rounded-md border border-input bg-input-background h-9 px-3 min-w-[5rem] text-sm font-normal text-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-8 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-md",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "border-b border-border",
        head_cell:
          "text-muted-foreground w-9 h-9 text-center text-[0.75rem] font-medium uppercase tracking-wider p-0",
        row: "border-b border-border/50 last:border-b-0",
        cell: cn(
          "relative p-0 text-center w-9 min-w-[2.25rem] min-h-9 align-middle",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal text-sm aria-selected:opacity-100 rounded-md",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground font-medium",
        day_outside:
          "day-outside text-muted-foreground/50 aria-selected:text-muted-foreground/50",
        day_disabled: "text-muted-foreground opacity-40 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        vhidden: "sr-only",
        ...classNames,
      }}
      components={{
        IconLeft: (iconProps) => (
          <ChevronLeft className={cn("size-4", className)} {...iconProps} />
        ),
        IconRight: (iconProps) => (
          <ChevronRight className={cn("size-4", className)} {...iconProps} />
        ),
        IconDropdown: () => null,
      }}
      {...props}
    />
  );
}

export { Calendar };
