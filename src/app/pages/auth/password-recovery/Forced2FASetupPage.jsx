"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import QRCode from "qrcode";
import { AuthPageContainer, AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../../components/ui/input-otp";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { confirmTwoFactorSetup, setupTwoFactor } from "../../../services/auth";
import { APIError } from "../../../services/api";

/**
 * Required 2FA enrollment: load QR, then verify with OTP before unlocking the app.
 */
export default function Forced2FASetupPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [otp, setOtp] = useState("");
  const autoStarted = useRef(false);
  const verifyingRef = useRef(false);
  const otpWrapRef = useRef(null);

  const identifier = user?.email || user?.username || "";

  useEffect(() => {
    if (user == null) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.mustChangePassword) {
      navigate("/auth/force-password-change", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!otpauthUri) {
      setQrDataUrl("");
      return undefined;
    }
    if (otpauthUri.startsWith("data:image") || /^https?:\/\//i.test(otpauthUri)) {
      setQrDataUrl(otpauthUri);
      return undefined;
    }
    setQrBusy(true);
    QRCode.toDataURL(otpauthUri, { width: 240, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("");
          setError("Authenticator link received, but the QR image could not be generated. Use the manual key below.");
        }
      })
      .finally(() => {
        if (!cancelled) setQrBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  useEffect(() => {
    if (!setupReady || (!qrDataUrl && !manualSecret)) return undefined;
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
  }, [setupReady, qrDataUrl, manualSecret]);

  const startSetup = useCallback(async () => {
    if (!identifier) {
      setError("Sign in again before enabling two-factor authentication.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    setOtpauthUri("");
    setQrDataUrl("");
    setManualSecret("");
    setSetupReady(false);
    setOtp("");
    try {
      const result = await setupTwoFactor({ username: identifier, enable: true });
      const uri = String(result.qrCodeUri || "").trim();
      setOtpauthUri(uri);
      setManualSecret(String(result.secret || "").trim());
      setMessage("Scan the QR code with Google Authenticator (or a similar app), then enter the 6-digit code below.");
      setSetupReady(true);
      if (!uri && !result.secret) {
        setSetupReady(false);
        setError("2FA setup started but no authenticator QR was returned. Tap Retry.");
      }
    } catch (err) {
      setSetupReady(false);
      setError(err instanceof APIError ? err.message : "Unable to start 2FA setup. Tap Retry.");
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    if (!user || user.mustChangePassword || !identifier || autoStarted.current) return;
    autoStarted.current = true;
    void startSetup();
  }, [user, identifier, startSetup]);

  const handleVerify = useCallback(
    async (code = otp) => {
      const value = String(code || "").trim();
      if (value.length !== 6) {
        setError("Please enter the 6-digit code from your authenticator app.");
        return;
      }
      if (!identifier) {
        setError("Sign in again before confirming two-factor authentication.");
        return;
      }
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setError("");
      setVerifying(true);
      try {
        const result = await confirmTwoFactorSetup({ username: identifier, code: value });
        if (typeof updateUser === "function") {
          updateUser({
            ...(result.user || {}),
            has2FA: true,
            require2faSetup: false,
          });
        }
        navigate("/transactions", { replace: true });
      } catch (err) {
        setError(err instanceof APIError ? err.message : "Invalid verification code. Try again.");
        setOtp("");
      } finally {
        setVerifying(false);
        verifyingRef.current = false;
      }
    },
    [identifier, navigate, otp, updateUser],
  );

  const handleOtpChange = (value) => {
    setOtp(value);
    if (error) setError("");
    if (String(value || "").length === 6 && setupReady && !loading && !verifying) {
      void handleVerify(value);
    }
  };

  if (user == null) return null;

  const canVerify = setupReady && !loading && !verifying && (!!qrDataUrl || !!manualSecret);

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldCheck}
        iconBgClassName="bg-emerald-700"
        title="Set up two-factor authentication"
        description="Scan the barcode with your authenticator app, then enter the 6-digit code to finish setup."
      >
        <div className="space-y-4">
          {error ? (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          {message && !error ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm font-medium text-slate-800">Scan this barcode with your phone</p>
            {loading || qrBusy ? (
              <div className="mx-auto flex h-56 w-56 flex-col items-center justify-center gap-2 rounded bg-white">
                <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Preparing QR code…</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Two-factor authentication QR barcode"
                className="mx-auto h-56 w-56 rounded bg-white p-2"
              />
            ) : (
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded bg-white px-4 text-sm text-slate-500">
                QR not ready yet. Use Retry if this stays empty.
              </div>
            )}
            {manualSecret ? (
              <div className="space-y-1 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Or enter this key manually
                </p>
                <code className="block break-all rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                  {manualSecret}
                </code>
              </div>
            ) : null}
          </div>

          {setupReady && (qrDataUrl || manualSecret) ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
              <div ref={otpWrapRef} className="flex justify-center overflow-x-auto">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={handleOtpChange}
                  disabled={verifying || loading}
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
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {!setupReady || error ? (
              <Button
                type="button"
                className="w-full"
                variant={!setupReady || error ? "default" : "outline"}
                onClick={() => {
                  autoStarted.current = true;
                  void startSetup();
                }}
                disabled={loading || verifying || !identifier}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  "Retry QR setup"
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={() => handleVerify()}
              disabled={!canVerify || otp.length !== 6}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Verify and continue"
              )}
            </Button>
          </div>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
