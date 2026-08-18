"use client";

import { useMemo } from "react";
import { cn } from "../ui/utils";

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-600",
];

/**
 * Computes a 0–100 password strength score and 0–4 band index.
 * Frontend-only heuristic: length, character variety, no dictionary check.
 */
export function computePasswordStrength(password) {
  if (!password || password.length === 0) {
    return { score: 0, band: 0 };
  }
  let score = 0;
  if (password.length >= 14) score += 25;
  else if (password.length >= 10) score += 15;
  else if (password.length >= 6) score += 5;
  if (password.length >= 18) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  if (password.length >= 14 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score = Math.max(score, 85);
  }
  const clamped = Math.min(100, score);
  const band = Math.min(4, Math.floor(clamped / 25));
  return { score: clamped, band };
}

/**
 * Bank-grade password strength meter: progress bar + label.
 * Use with PasswordRequirementIndicators for policy (14+ chars, upper, lower, number, special).
 */
export function PasswordStrengthMeter({ password, className, showLabel = true, ...props }) {
  const { score, band } = useMemo(() => computePasswordStrength(password ?? ""), [password]);
  const label = STRENGTH_LABELS[band];
  const colorClass = STRENGTH_COLORS[band];

  return (
    <div className={cn("space-y-1.5", className)} role="group" aria-label="Password strength" {...props}>
      <div
        className="h-2 w-full rounded-full bg-slate-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Password strength"
      >
        <div
          className={cn("h-full transition-all duration-300 rounded-full", colorClass)}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-slate-400" aria-live="polite">
          Strength: {label}
        </p>
      )}
    </div>
  );
}
