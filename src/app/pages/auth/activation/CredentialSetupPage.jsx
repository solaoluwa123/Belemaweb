"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { useActivation } from "../../../context/ActivationContext";
import { FormField, ActivationPasswordRequirements, meetsAllPasswordRequirementsActivation } from "../../../components/activation";
import { PasswordStrengthMeter } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";

const REQ_ID = "activation-password-requirements";

export default function CredentialSetupPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { markCredentialsSet } = useActivation();

  const requirementsMet = meetsAllPasswordRequirementsActivation(password);
  const match = password && confirm && password === confirm;
  const canSubmit = requirementsMet && match;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    markCredentialsSet();
    setTimeout(() => {
      setLoading(false);
      navigate("/activate/mfa");
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Lock className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <CardTitle className="text-xl text-slate-900">Set your password</CardTitle>
          <CardDescription className="text-slate-600">
            Create a strong password that meets the security requirements below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField id="password" label="Password" required>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  placeholder="Enter password"
                  disabled={loading}
                  aria-describedby={REQ_ID}
                  aria-invalid={!!password && !requirementsMet}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>
            <PasswordStrengthMeter password={password} />
            <ActivationPasswordRequirements id={REQ_ID} password={password} />

            <FormField id="confirm" label="Confirm password" required error={confirm && !match ? "Passwords do not match." : undefined}>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pr-10"
                  placeholder="Confirm password"
                  disabled={loading}
                  aria-invalid={!!confirm && !match}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
              {loading ? "Continuing…" : "Continue"}
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => navigate("/activate/confirm")} className="text-sm text-slate-500 hover:text-slate-700">
                Back
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
