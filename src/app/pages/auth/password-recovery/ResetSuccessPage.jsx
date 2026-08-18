"use client";

import { useNavigate } from "react-router";
import { usePasswordRecovery } from "../../../context/PasswordRecoveryContext";
import { AuthPageContainer } from "../../../components/auth";
import { AuthCardLayout } from "../../../components/auth";
import { Button } from "../../../components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function ResetSuccessPage() {
  const navigate = useNavigate();
  const { resetFlow } = usePasswordRecovery();

  const handleSignIn = () => {
    resetFlow();
    navigate("/login", { replace: true });
  };

  return (
    <AuthPageContainer>
      <AuthCardLayout
        icon={CheckCircle2}
        iconBgClassName="bg-green-600"
        title="Password updated"
        description="Your password has been changed successfully. Please sign in with your new password."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-sm text-slate-300">
            <p>For your security, please sign in again. Do not share your password with anyone.</p>
          </div>
          <Button onClick={handleSignIn} className="w-full">
            Sign in
          </Button>
        </div>
      </AuthCardLayout>
    </AuthPageContainer>
  );
}
