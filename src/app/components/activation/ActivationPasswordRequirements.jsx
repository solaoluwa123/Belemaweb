"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../ui/utils";

const MIN_LENGTH = 12;

const REQUIREMENTS = [
  { key: "minLength", label: `At least ${MIN_LENGTH} characters`, test: (p) => (p ?? "").length >= MIN_LENGTH },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p ?? "") },
  { key: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p ?? "") },
  { key: "number", label: "One number", test: (p) => /\d/.test(p ?? "") },
  { key: "special", label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p ?? "") },
];

export function meetsAllPasswordRequirementsActivation(password) {
  return REQUIREMENTS.every((r) => r.test(password ?? ""));
}

/**
 * Password requirement indicators for activation flow (12+ characters).
 */
export function ActivationPasswordRequirements({ password, id, className, ...props }) {
  const states = useMemo(() => REQUIREMENTS.map((r) => ({ ...r, met: r.test(password) })), [password]);

  return (
    <ul id={id} className={cn("space-y-1.5 text-sm text-slate-600", className)} {...props}>
      {states.map(({ key, label, met }) => (
        <li key={key} className={cn("flex items-center gap-2", met ? "text-emerald-600" : "text-slate-500")}>
          {met ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <X className="h-4 w-4 shrink-0 opacity-60" aria-hidden />}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
