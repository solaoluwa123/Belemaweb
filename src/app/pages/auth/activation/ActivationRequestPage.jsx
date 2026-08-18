"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Mail, Link2, KeyRound } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { isValidEmail, sanitizeInput } from "../../../utils/security";
import { requestActivationLink } from "../../../services/activationService";

export default function ActivationRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [sentActivation, setSentActivation] = useState(null);

  useEffect(() => {
    const existingToken = searchParams.get("token");
    if (existingToken) {
      navigate(`/activate/verify?token=${encodeURIComponent(existingToken)}`, { replace: true });
    }
  }, [navigate, searchParams]);

  const activationUrl = useMemo(() => {
    if (!sentActivation) return "";
    if (typeof window === "undefined") return sentActivation.activationPath;
    return `${window.location.origin}${sentActivation.activationPath}`;
  }, [sentActivation]);

  const handleRequestLink = async (event) => {
    event.preventDefault();
    const normalizedEmail = sanitizeInput(email).trim().toLowerCase();

    if (!normalizedEmail) {
      setRequestError("Enter the email address linked to your activation invitation.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setRequestError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setRequestError("");

    const result = await requestActivationLink(normalizedEmail);
    setLoading(false);

    if (!result.success) {
      setRequestError(result.message || "Unable to send activation link right now.");
      return;
    }

    setSentActivation(result);
    setToken(result.token);
  };

  const handleManualToken = (event) => {
    event.preventDefault();
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setManualError("Enter the activation token from your email.");
      return;
    }
    setManualError("");
    navigate(`/activate/verify?token=${encodeURIComponent(normalizedToken)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-slate-200 shadow-sm">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <Mail className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-xl text-slate-900">Activate your account</CardTitle>
            <CardDescription className="text-slate-600">
              Enter your email address to receive an activation link. You can then click the link or paste the token manually.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleRequestLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activation-email">Email address</Label>
              <Input
                id="activation-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your invitation email"
                disabled={loading}
              />
            </div>
            {requestError ? <p className="text-sm text-red-600">{requestError}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending activation link..." : "Send activation link"}
            </Button>
          </form>

          {sentActivation ? (
            <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden />
                <div className="space-y-1 text-sm text-emerald-900">
                  <p>{sentActivation.message}</p>
                  <p>In this mock flow, the activation URL and token are shown below for testing.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activation-link-preview">Activation link</Label>
                <Input id="activation-link-preview" readOnly value={activationUrl} />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate(sentActivation.activationPath)}>
                Open activation link
              </Button>
            </div>
          ) : null}

          <form onSubmit={handleManualToken} className="space-y-4 border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <KeyRound className="h-4 w-4" aria-hidden />
              <span>Already have the activation token?</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activation-token">Activation token</Label>
              <Input
                id="activation-token"
                type="text"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste the token from your email"
              />
            </div>
            {manualError ? <p className="text-sm text-red-600">{manualError}</p> : null}
            <Button type="submit" variant="outline" className="w-full">
              Continue with token
            </Button>
          </form>

          <div className="text-center">
            <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={() => navigate("/login")}>
              Back to login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
