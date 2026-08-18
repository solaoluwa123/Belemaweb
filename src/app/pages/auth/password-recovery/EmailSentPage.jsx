"use client";

import { useNavigate } from "react-router";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Mail, ShieldCheck } from "lucide-react";

/**
 * Email-sent confirmation. Message is generic to prevent email enumeration:
 * same copy whether the account exists or not.
 */
export default function EmailSentPage() {
  const navigate = useNavigate();

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={Mail}
        iconBgClassName="bg-green-600"
        title="Check your email"
        description="If an account exists for the address you entered, you will receive password reset instructions shortly. Please check your inbox and spam folder. Links expire for security reasons."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-sm text-slate-300">
            <p className="flex items-center gap-2 font-medium text-slate-200">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              Secure process
            </p>
            <p className="mt-1 text-xs">
              For your security, we do not confirm whether an account exists. Follow the instructions only if you receive an email.
            </p>
          </div>
          <Button onClick={() => navigate("/login")} className="w-full">
            Back to sign in
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/password-recovery")}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:underline"
            >
              Use a different email
            </button>
          </div>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
