"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { AuthPageContainer, AuthCardLayout, PasswordStrengthMeter, PasswordRequirementIndicators, meetsAllPasswordRequirements } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Lock, Eye, EyeOff, AlertCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const REQUIREMENTS_ID = "force-password-requirements";

/**
 * Forced password change for expired credentials (e.g. after login or session check).
 * Same UX as Reset Password: strength meter + requirement indicators.
 */
export default function ForcedPasswordChangePage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, completePasswordChange } = useAuth();

  useEffect(() => {
    if (user == null) navigate("/login", { replace: true });
  }, [user, navigate]);

  const requirementsMet = meetsAllPasswordRequirements(password);
  const passwordsMatch = password && confirm && password === confirm;
  const canSubmit = requirementsMet && passwordsMatch;

  if (user == null) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    if (!user?.id) {
      setError("Session expired. Please log in again.");
      navigate("/login", { replace: true });
      return;
    }
    setLoading(true);
    setTimeout(async () => {
      const ok = await completePasswordChange(user.id, password);
      setLoading(false);
      if (ok) {
        navigate("/transactions", { replace: true });
      } else {
        setError("Failed to update password. Try again.");
      }
    }, 600);
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldAlert}
        iconBgClassName="bg-amber-600"
        title="Password change required"
        description="Your password has expired. You must set a new password to continue. This is required for security compliance."
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
            <Label htmlFor="force-new-password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="force-new-password"
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
            <Label htmlFor="force-confirm-password">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="force-confirm-password"
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
            {loading ? "Updating…" : "Update password and continue"}
          </Button>
        </form>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
