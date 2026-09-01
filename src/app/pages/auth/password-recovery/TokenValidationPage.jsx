"use client";

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Loader2, ShieldCheck } from "lucide-react";

const MIN_VALIDATION_MS = 800;

/**
 * Reads ref + token from the password-reset email link and stores them for reset.
 */
export default function TokenValidationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    startValidation,
    markTokenValid,
    markTokenExpired,
    setRecoveryRef,
    setRecoveryToken,
    setEmail,
  } = usePasswordRecovery();

  useEffect(() => {
    startValidation();
    const ref = (searchParams.get("ref") || "").trim();
    const token = (searchParams.get("token") || "").trim();
    const email = (searchParams.get("email") || "").trim();
    const start = Date.now();

    const redirect = () => {
      if (!ref || !token) {
        markTokenExpired();
        navigate("/password-recovery/expired", { replace: true });
        return;
      }
      setRecoveryRef(ref);
      setRecoveryToken(token);
      if (email) {
        setEmail(email);
      }
      markTokenValid();
      navigate("/password-recovery/reset", { replace: true });
    };

    const elapsed = () => Date.now() - start;
    const id = setTimeout(redirect, Math.max(0, MIN_VALIDATION_MS - elapsed()));

    return () => clearTimeout(id);
  }, [
    searchParams,
    navigate,
    startValidation,
    markTokenValid,
    markTokenExpired,
    setRecoveryRef,
    setRecoveryToken,
    setEmail,
  ]);

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldCheck}
        iconBgClassName="bg-primary"
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
