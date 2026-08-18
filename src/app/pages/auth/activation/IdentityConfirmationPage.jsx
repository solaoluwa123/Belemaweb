"use client";

import { useNavigate } from "react-router";
import { useActivation } from "../../../context/ActivationContext";
import { SecurityMessage } from "../../../components/activation";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { UserCheck } from "lucide-react";

export default function IdentityConfirmationPage() {
  const navigate = useNavigate();
  const { user } = useActivation();

  const displayUser = user ?? {
    organizationName: "Central Clearing Bank",
    role: "Settlement Analyst",
    maskedEmail: "j.***th@centralclearing.bank",
  };

  const handleConfirm = () => navigate("/activate/credentials");
  const handleCancel = () => navigate("/login");

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
            <UserCheck className="h-6 w-6 text-indigo-600" aria-hidden />
          </div>
          <CardTitle className="text-xl text-slate-900">Confirm your identity</CardTitle>
          <CardDescription className="text-slate-600">
            Verify the details below before continuing with account activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Organization</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{displayUser.organizationName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{displayUser.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</dt>
              <dd className="mt-0.5 text-sm font-mono text-slate-900">{displayUser.maskedEmail}</dd>
            </div>
          </dl>
          <SecurityMessage>
            Only continue if this information matches your invitation. Do not proceed on shared or public devices.
          </SecurityMessage>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleConfirm} className="w-full">
              Confirm and continue
            </Button>
            <Button variant="outline" onClick={handleCancel} className="w-full">
              Cancel activation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
