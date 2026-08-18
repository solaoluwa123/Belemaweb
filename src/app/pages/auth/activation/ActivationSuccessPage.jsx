"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useActivation } from "../../../context/ActivationContext";
import { markActivationComplete } from "../../../services/activationService";
import { SecurityMessage } from "../../../components/activation";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { CheckCircle2 } from "lucide-react";

const REDIRECT_SECONDS = 10;

export default function ActivationSuccessPage() {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const navigate = useNavigate();
  const { user, activationToken, reset } = useActivation();

  useEffect(() => {
    if (activationToken) {
      markActivationComplete(activationToken);
    }
  }, [activationToken]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          reset();
          navigate("/login", { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [navigate, reset]);

  const displayUser = user ?? { organizationName: "Central Clearing Bank", role: "Settlement Analyst" };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
          </div>
          <CardTitle className="text-xl text-slate-900">Account activated</CardTitle>
          <CardDescription className="text-slate-600">
            Your account has been successfully activated. You can now sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Organization</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{displayUser.organizationName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{displayUser.role}</dd>
            </div>
          </dl>
          <SecurityMessage>
            For security, you will be signed out after activation. Sign in with your new password and complete MFA when prompted.
          </SecurityMessage>
          <p className="text-center text-sm text-slate-500">
            Redirecting to sign in in {secondsLeft} second{secondsLeft !== 1 ? "s" : ""}…
          </p>
          <Button onClick={() => { reset(); navigate("/login", { replace: true }); }} className="w-full">
            Sign in now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
