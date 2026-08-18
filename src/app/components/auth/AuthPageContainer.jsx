"use client";

import { cn } from "../ui/utils";

/**
 * Full-page container for auth flows. Provides consistent gradient background,
 * centering, and responsive padding. Use for all password recovery and auth screens.
 */
export function AuthPageContainer({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "min-h-screen flex items-center justify-center p-4 sm:p-6",
        "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900",
        "safe-area-inset-bottom",
        className
      )}
      role="main"
      {...props}
    >
      {children}
    </div>
  );
}
