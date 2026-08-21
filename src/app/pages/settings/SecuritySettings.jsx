import { useEffect, useState } from "react";
import { Link } from "react-router";
import QRCode from "qrcode";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { setupTwoFactor } from "../../services/auth";
import { APIError } from "../../services/api";

export default function SecuritySettings() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  const identifier = user?.email || user?.username || "";

  useEffect(() => {
    let cancelled = false;
    if (!otpauthUri) {
      setQrDataUrl("");
      return undefined;
    }

    // Already an image URL / data URI from a future API change.
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
      if (!uri) {
        setError("2FA was enabled but no authenticator link was returned. Try again or contact support.");
      }
      if (typeof updateUser === "function") {
        updateUser({ has2FA: true });
      }
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Unable to enable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage authenticator-based two-factor authentication for {identifier || "your account"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            {user?.has2FA
              ? "2FA is enabled. On the next sign-in you will be asked for a 6-digit authenticator code."
              : "Enable 2FA to require a code from Google Authenticator after your password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {message ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          {otpauthUri || qrDataUrl || manualSecret ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
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
                After scanning, sign out and sign in again to complete a 2FA challenge.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleEnable} disabled={loading || !identifier}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {user?.has2FA ? "Regenerate authenticator" : "Enable 2FA"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/transactions">Back</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
