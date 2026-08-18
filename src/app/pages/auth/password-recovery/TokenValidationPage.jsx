"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Loader2, ShieldCheck } from "lucide-react";

const MIN_VALIDATION_MS = 1800;

/**
 * Verifies reset link (mock). After a minimum delay, redirects to MFA, Reset, Expired, or Locked.
 * Token in URL for demo only: ?token=valid | expired | locked
 */
export default function TokenValidationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { startValidation, markTokenValid, markTokenExpired, markLocked, setRecoveryToken } = usePasswordRecovery();

  useEffect(() => {
    startValidation();
    const token = searchParams.get("token") ?? "valid";
    const start = Date.now();

    const redirect = () => {
      if (token === "locked") {
        setRecoveryToken("");
        markLocked();
        navigate("/password-recovery/locked", { replace: true });
        return;
      }
      if (token === "expired" || token === "invalid") {
        setRecoveryToken("");
        markTokenExpired();
        navigate("/password-recovery/expired", { replace: true });
        return;
      }
      markTokenValid();
      // Raw token for POST /users/resetpassword; demo keyword `valid` uses a placeholder.
      setRecoveryToken(token === "valid" ? "demo-recovery-token" : token);
      navigate("/password-recovery/mfa", { replace: true });
    };

    const elapsed = () => Date.now() - start;
    const id = setTimeout(redirect, Math.max(0, MIN_VALIDATION_MS - elapsed()));

    return () => clearTimeout(id);
  }, [searchParams, navigate, startValidation, markTokenValid, markTokenExpired, markLocked, setRecoveryToken]);

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldCheck}
        iconBgClassName="bg-blue-600"
        title="Verifying secure link"
        description="Please wait while we verify your reset link. Do not close this window."
      >
        <div className="flex flex-col items-center justify-center py-8" aria-live="polite" aria-busy="true">
          <Loader2 className="h-10 w-10 animate-spin text-blue-400" aria-hidden />
          <p className="mt-4 text-sm text-slate-400">Verifying link…</p>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
