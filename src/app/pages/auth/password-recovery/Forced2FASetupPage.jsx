"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import QRCode from "qrcode";
import { AuthPageContainer, AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { setupTwoFactor, getPostAuthRedirectPath } from "../../../services/auth";
import { APIError } from "../../../services/api";

/**
 * Required 2FA enrollment: immediately loads a scannable QR for the authenticator app.
 */
export default function Forced2FASetupPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const autoStarted = useRef(false);

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
    try {
      const result = await setupTwoFactor({ username: identifier, enable: true });
      const uri = String(result.qrCodeUri || "").trim();
      setOtpauthUri(uri);
      setManualSecret(String(result.secret || "").trim());
      setMessage("Scan the QR code with Google Authenticator (or a similar app) on your phone.");
      setEnabled(true);
      if (!uri && !result.secret) {
        setError("2FA was enabled but no authenticator QR was returned. Tap Retry.");
      }
      if (typeof updateUser === "function") {
        updateUser({ has2FA: true, require2faSetup: false });
      }
    } catch (err) {
      setEnabled(false);
      setError(err instanceof APIError ? err.message : "Unable to start 2FA setup. Tap Retry.");
    } finally {
      setLoading(false);
    }
  }, [identifier, updateUser]);

  useEffect(() => {
    if (!user || user.mustChangePassword || !identifier || autoStarted.current) return;
    autoStarted.current = true;
    void startSetup();
  }, [user, identifier, startSetup]);

  if (user == null) return null;

  const handleContinue = () => {
    const next = getPostAuthRedirectPath({
      ...user,
      mustChangePassword: false,
      require2faSetup: false,
      has2FA: true,
    });
    navigate(next, { replace: true });
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={ShieldCheck}
        iconBgClassName="bg-emerald-700"
        title="Set up two-factor authentication"
        description="Open your authenticator app on your phone and scan the barcode below. This is required before you can continue."
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
            <p className="text-xs text-slate-500">
              After scanning, use Continue. On your next sign-in you will enter the 6-digit code from the app.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!enabled || error ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  autoStarted.current = true;
                  void startSetup();
                }}
                disabled={loading || !identifier}
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
              onClick={handleContinue}
              disabled={!enabled || loading || (!qrDataUrl && !manualSecret)}
            >
              I have scanned — Continue
            </Button>
          </div>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
