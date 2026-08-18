"use client";

import { useNavigate } from "react-router";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { Link2Off, AlertTriangle } from "lucide-react";

/**
 * Shown for invalid or expired reset links. Generic messaging to avoid enumeration.
 */
export default function ExpiredInvalidLinkPage() {
  const navigate = useNavigate();

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={Link2Off}
        iconBgClassName="bg-amber-600"
        title="Link invalid or expired"
        description="This password reset link is invalid or has expired. Request a new link to continue."
      >
        <div className="space-y-4">
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p>For security, reset links expire after a short time. Please start the process again.</p>
          </div>
          <Button onClick={() => navigate("/password-recovery")} className="w-full">
            Request new reset link
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
