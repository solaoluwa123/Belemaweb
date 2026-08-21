import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../components/ui/input-otp";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function TwoFactorAuth() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { pendingTwoFactor, verifyTwoFactor } = useAuth();
  const verifyingRef = useRef(false);
  const otpWrapRef = useRef(null);

  useEffect(() => {
    const focusOtp = () => {
      const root = otpWrapRef.current;
      if (!root) return;
      const input = root.querySelector('input[data-slot="input-otp"], input[autocomplete="one-time-code"], input');
      if (input && typeof input.focus === "function") {
        input.focus({ preventScroll: true });
      }
    };
    focusOtp();
    const raf = requestAnimationFrame(focusOtp);
    const t = setTimeout(focusOtp, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  const handleVerify = async (code = otp) => {
    const value = String(code || "").trim();
    if (value.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;

    setError("");
    setLoading(true);

    try {
      const result = await verifyTwoFactor(value);

      if (!result.success) {
        setError(result.error || "Invalid verification code");
        return;
      }

      if (result.mustChangePassword) {
        navigate("/auth/force-password-change", { replace: true });
        return;
      }

      if (result.require2faSetup) {
        navigate("/auth/force-2fa-setup", { replace: true });
        return;
      }

      navigate(result.redirectTo || "/transactions", { replace: true });
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  const handleOtpChange = (value) => {
    setOtp(value);
    if (error) setError("");
    if (String(value || "").length === 6 && pendingTwoFactor && !loading) {
      void handleVerify(value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app for{" "}
              {pendingTwoFactor?.identifier || "your account"}. This is required when 2FA is enabled on your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div ref={otpWrapRef} className="flex justify-center overflow-x-auto">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={handleOtpChange}
              autoFocus
              containerClassName="justify-center"
              inputMode="numeric"
              autoComplete="one-time-code"
            >
              <InputOTPGroup className="gap-0.5 sm:gap-1">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button onClick={() => handleVerify()} className="w-full" disabled={loading || otp.length !== 6 || !pendingTwoFactor}>
            {loading ? "Verifying..." : "Verify"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-primary hover:underline"
            >
              Back to login
            </button>
          </div>

          {!pendingTwoFactor && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Your verification session is missing or expired. Return to login and sign in again.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
