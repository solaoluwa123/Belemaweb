"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import QRCode from "qrcode";
import { AuthPageContainer, AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { setupTwoFactor, getPostAuthRedirectPath } from "../../../services/auth";
import { APIError } from "../../../services/api";

/**
 * Required 2FA enrollment when app.require-2fa is on and the user has not enabled 2FA.
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
    QRCode.toDataURL(otpauthUri, { width: 220, margin: 2, errorCorrectionLevel: "M" })
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

  if (user == null) return null;

  const handleEnable = async () => {
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
      setMessage(result.message || "Two-factor authentication enabled.");
      setEnabled(true);
      if (!uri && !result.secret) {
        setError("2FA was enabled but no authenticator link was returned. Try again or contact support.");
      }
      if (typeof updateUser === "function") {
        updateUser({ has2FA: true, require2faSetup: false });
      }
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Unable to enable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  };

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
        title="Two-factor authentication required"
        description="Your organization requires authenticator-based 2FA before you can use the app. Scan the QR code, then continue."
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
          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          {otpauthUri || qrDataUrl || manualSecret ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-slate-800">Scan this QR code in your authenticator app</p>
              {qrBusy ? (
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="2FA QR code" className="mx-auto h-48 w-48 rounded bg-white p-2" />
              ) : (
                <p className="text-sm text-slate-500">QR image unavailable — enter the key manually.</p>
              )}
              {manualSecret ? (
                <div className="space-y-1 text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Manual setup key</p>
                  <code className="block break-all rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {manualSecret}
                  </code>
                </div>
              ) : null}
              <p className="text-xs text-slate-500">
                On your next sign-in you will be asked for a 6-digit authenticator code.
              </p>
            </div>
          ) : null}

          {!enabled ? (
            <Button type="button" className="w-full" onClick={handleEnable} disabled={loading || !identifier}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling…
                </>
              ) : (
                "Enable 2FA"
              )}
            </Button>
          ) : (
            <Button type="button" className="w-full" onClick={handleContinue}>
              Continue
            </Button>
          )}
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
