"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../../components/ui/input-otp";
import { ShieldCheck, AlertCircle } from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

export default function MfaVerificationPage() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const { markMfaVerified } = usePasswordRecovery();

  const handleVerify = () => {
    setError("");
    if (otp.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      markMfaVerified();
      setLoading(false);
      navigate("/password-recovery/reset", { replace: true });
    }, 1200);
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(RESEND_COOLDOWN_SEC);
    const id = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldCheck}
        iconBgClassName="bg-green-600"
        title="Verify your identity"
        description="Enter the 6-digit code from your authenticator app to continue with password reset."
      >
        <div className="space-y-6">
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-2">
            <label id="otp-label" className="text-sm font-medium text-slate-200">
              Verification code
            </label>
            <InputOTP
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={(v) => {
                setOtp(v);
                setError("");
              }}
              aria-labelledby="otp-label"
              aria-invalid={!!error}
            >
              <InputOTPGroup className="gap-1 sm:gap-2">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={loading || otp.length !== OTP_LENGTH}
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50 disabled:no-underline focus:outline-none focus:underline"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-slate-400 hover:text-slate-300 hover:underline focus:outline-none focus:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
