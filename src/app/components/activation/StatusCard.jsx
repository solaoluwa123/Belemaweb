"use client";

import { cn } from "../ui/utils";

/**
 * Status block for token validation outcomes: valid, expired, invalid, used, suspended.
 * Clean UI block per state — no gradients, corporate look.
 */
export function StatusCard({
  title,
  description,
  icon: Icon,
  iconClassName = "bg-slate-100 text-slate-600",
  actions,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
      {actions && <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>}
    </div>
  );
}
