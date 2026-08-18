"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "../ui/utils";

/**
 * Security-focused message block for activation flow. Neutral, corporate tone.
 */
export function SecurityMessage({ children, className, variant = "default", ...props }) {
  const isWarning = variant === "warning";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 text-sm",
        isWarning
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-700",
        className
      )}
      role="status"
      {...props}
    >
      <ShieldCheck className={cn("h-5 w-5 shrink-0", isWarning ? "text-amber-600" : "text-slate-500")} aria-hidden />
      <div>{children}</div>
    </div>
  );
}
