"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { useActivation } from "../../../context/ActivationContext";
import { verifyOTP, generateBackupCodes } from "../../../services/activationService";
import { FormField, SecurityMessage } from "../../../components/activation";
import { Button } from "../../../components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../../components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { ShieldCheck, Copy, Download } from "lucide-react";
import { useBrand } from "../../../../branding/useBrand";

const OTP_LENGTH = 6;
const MOCK_SECRET_KEY = "JBSWY3DPEHPK3PXP";

export default function MfaSetupPage() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const navigate = useNavigate();
  const { markMfaVerified } = useActivation();
  const { brand } = useBrand();
  const qrPlaceholder = `otpauth://totp/${brand.displayName}:user@example.com?secret=${MOCK_SECRET_KEY}`;

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit code from your authenticator app.");
      return;
    }
    setLoading(true);
    const res = await verifyOTP(otp);
    setLoading(false);
    if (res.success) {
      setOtpVerified(true);
      const codes = await generateBackupCodes();
      setBackupCodes(codes);
      markMfaVerified();
    } else {
      setError(res.message ?? "Verification failed. Try again.");
    }
  };

  const handleContinue = () => {
    navigate("/activate/success");
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob(
      [`${brand.mockBrand.backupCodesLabel}\n\n${backupCodes.join("\n")}\n\nStore securely. Do not share.`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = brand.mockBrand.backupCodesFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <ShieldCheck className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <CardTitle className="text-xl text-slate-900">Set up two-factor authentication</CardTitle>
          <CardDescription className="text-slate-600">
            MFA is required before first sign-in. Scan the QR code or enter the key in your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!otpVerified ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">QR code</p>
                  <div className="flex h-32 w-32 items-center justify-center rounded border-2 border-dashed border-slate-300 bg-white text-slate-400" title={qrPlaceholder}>
                    <span className="text-xs">QR placeholder</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">Manual key</p>
                  <code className="break-all rounded bg-slate-100 px-2 py-1.5 text-sm text-slate-800">{MOCK_SECRET_KEY}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(MOCK_SECRET_KEY)}
                    className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <Copy className="h-3 w-3" /> Copy key
                  </button>
                </div>
              </div>

              <FormField id="otp" label="Enter 6-digit code from your app" error={error}>
                <div className="flex justify-center">
                  <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp} aria-invalid={!!error}>
                    <InputOTPGroup className="gap-1">
                      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </FormField>
              <Button onClick={handleVerifyOtp} className="w-full" disabled={loading || otp.length !== OTP_LENGTH}>
                {loading ? "Verifying…" : "Verify and continue"}
              </Button>
            </>
          ) : (
            <>
              <SecurityMessage>
                Two-factor authentication is enabled. Store your backup codes in a secure place. Each code can only be used once.
              </SecurityMessage>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Backup codes</p>
                <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-700">
                  {backupCodes?.map((code, i) => (
                    <li key={i}>{code}</li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleDownloadBackupCodes}>
                  <Download className="mr-2 h-4 w-4" /> Download backup codes
                </Button>
              </div>
              <Button onClick={handleContinue} className="w-full">
                Continue to activation
              </Button>
            </>
          )}
          <div className="text-center">
            <button type="button" onClick={() => navigate("/activate/credentials")} className="text-sm text-slate-500 hover:text-slate-700">
              Back
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
