"use client";

import { useNavigate } from "react-router";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Lock } from "lucide-react";

export default function AccountLockedPage() {
  const navigate = useNavigate();

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={Lock}
        iconBgClassName="bg-red-600"
        title="Account temporarily locked"
        description="Too many failed attempts. For your security, account recovery is temporarily unavailable. Please try again later or contact support."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-sm text-slate-300">
            <p>If you did not request a password reset, you can safely ignore this. Your account remains secure.</p>
          </div>
          <Button onClick={() => navigate("/login")} className="w-full" variant="outline">
            Back to sign in
          </Button>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
