"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../ui/utils";

const MIN_LENGTH = 14;

/**
 * Returns requirement met state for enterprise policy: 14+ chars, upper, lower, number, special.
 */
export function getPasswordRequirements(password) {
  const p = password ?? "";
  return {
    minLength: p.length >= MIN_LENGTH,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /\d/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  };
}

/**
 * Returns true only when all requirements are met.
 */
export function meetsAllPasswordRequirements(password) {
  const r = getPasswordRequirements(password);
  return r.minLength && r.uppercase && r.lowercase && r.number && r.special;
}

const REQUIREMENTS = [
  { key: "minLength", label: `At least ${MIN_LENGTH} characters`, test: (p) => (p ?? "").length >= MIN_LENGTH },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p ?? "") },
  { key: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p ?? "") },
  { key: "number", label: "One number", test: (p) => /\d/.test(p ?? "") },
  { key: "special", label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p ?? "") },
];

/**
 * List of requirement indicators with check/cross. Link to password field via aria-describedby.
 */
export function PasswordRequirementIndicators({ password, id, className, ...props }) {
  const states = useMemo(() => REQUIREMENTS.map((r) => ({ ...r, met: r.test(password) })), [password]);

  return (
    <ul
      id={id}
      className={cn("space-y-1.5 text-sm", className)}
      aria-describedby={id ? undefined : undefined}
      {...props}
    >
      {states.map(({ key, label, met }) => (
        <li
          key={key}
          className={cn(
            "flex items-center gap-2",
            met ? "text-green-600 dark:text-green-400" : "text-slate-500"
          )}
        >
          {met ? (
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <X className="w-4 h-4 shrink-0 opacity-60" aria-hidden="true" />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
