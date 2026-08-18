"use client";

import { Label } from "../ui/label";
import { cn } from "../ui/utils";

/**
 * Reusable form field with label and optional error. Enterprise activation forms.
 */
export function FormField({
  id,
  label,
  error,
  required,
  children,
  className,
  ...props
}) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {label && (
        <Label htmlFor={id} className="text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </Label>
      )}
      {children}
      {error && (
        <p id={id ? `${id}-error` : undefined} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
