import { useState } from "react";
import { Link } from "react-router";
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
  const [qrCodeUri, setQrCodeUri] = useState("");

  const identifier = user?.email || user?.username || "";

  const handleEnable = async () => {
    if (!identifier) {
      setError("Sign in again before enabling two-factor authentication.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await setupTwoFactor({ username: identifier, enable: true });
      setQrCodeUri(result.qrCodeUri || "");
      setMessage(result.message || "Two-factor authentication enabled.");
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
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            {user?.has2FA
              ? "2FA is enabled. On the next sign-in you will be asked for a 6-digit authenticator code."
              : "Enable 2FA to require a code from Google Authenticator (or similar) after your password."}
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

          {qrCodeUri ? (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Scan this QR code in your authenticator app</p>
              <img src={qrCodeUri} alt="2FA QR code" className="mx-auto h-48 w-48 rounded bg-white p-2" />
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
