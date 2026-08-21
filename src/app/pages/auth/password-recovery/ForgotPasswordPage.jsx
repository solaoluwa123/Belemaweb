"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { KeyRound, Mail, AlertCircle } from "lucide-react";
import { APIError } from "../../../services/api";
import { requestPasswordRecovery } from "../../../services/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { setEmail: setRecoveryEmail } = usePasswordRecovery();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setRecoveryEmail(email);

    try {
      await requestPasswordRecovery(email.trim());
    } catch (error) {
      if (!(error instanceof APIError)) {
        setError("Unable to submit the password recovery request.");
        setLoading(false);
        return;
      }
      // Keep the response generic to avoid account enumeration.
    }

    setTimeout(() => {
      setLoading(false);
      navigate("/password-recovery/sent");
    }, 1500);
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={KeyRound}
        iconBgClassName="bg-primary"
        title="Reset password"
        description="Enter your account email. If an account exists, you will receive instructions to reset your password."
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
            <Label htmlFor="forgot-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="Email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? "forgot-error" : undefined}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset instructions"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:underline"
            >
              Back to sign in
            </button>
          </div>
        </form>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
