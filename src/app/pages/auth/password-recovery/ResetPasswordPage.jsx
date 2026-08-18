"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { resetPasswordWithApi } from "../../../services/auth";
import { APIError } from "../../../services/api";
import { AuthPageContainer, AuthCardLayout, PasswordStrengthMeter, PasswordRequirementIndicators, meetsAllPasswordRequirements } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

const REQUIREMENTS_ID = "reset-password-requirements";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { markResetComplete, email, recoveryToken } = usePasswordRecovery();

  const requirementsMet = meetsAllPasswordRequirements(password);
  const passwordsMatch = password && confirm && password === confirm;
  const canSubmit = requirementsMet && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    const identifier = String(email || "").trim();
    const token = String(recoveryToken || "").trim();
    if (!identifier) {
      setError('Recovery email is missing. Start again from "Forgot password".');
      return;
    }
    if (!token) {
      setError("Reset link is invalid or expired. Request a new link.");
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithApi({ username: identifier, password, token });
      markResetComplete();
      navigate("/password-recovery/success", { replace: true });
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={Lock}
        iconBgClassName="bg-blue-600"
        title="Create new password"
        description="Your password must meet the following requirements. Enter and confirm your new password."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Enter new password"
                disabled={loading}
                aria-invalid={!!password && !requirementsMet}
                aria-describedby={REQUIREMENTS_ID}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
            <PasswordRequirementIndicators id={REQUIREMENTS_ID} password={password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Confirm new password"
                disabled={loading}
                aria-invalid={!!confirm && !passwordsMatch}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm && !passwordsMatch && (
              <p className="text-xs text-red-500" role="alert">
                Passwords do not match.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-slate-400 hover:text-slate-300 hover:underline focus:outline-none focus:underline"
            >
              Back to sign in
            </button>
          </div>
        </form>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
