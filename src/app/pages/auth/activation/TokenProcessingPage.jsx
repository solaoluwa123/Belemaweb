"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { validateToken, TOKEN_OUTCOMES } from "../../../services/activationService";
import { useActivation } from "../../../context/ActivationContext";
import { StatusCard } from "../../../components/activation";
import { Button } from "../../../components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, UserCheck, Ban } from "lucide-react";

const STATUS_CONFIG = {
  [TOKEN_OUTCOMES.valid]: {
    title: "Link verified",
    description: "Your activation link is valid. Proceeding to identity confirmation.",
    Icon: CheckCircle2,
    iconClassName: "bg-emerald-100 text-emerald-600",
  },
  [TOKEN_OUTCOMES.expired]: {
    title: "Link expired",
    description: "This activation link has expired. Contact your administrator to request a new one.",
    Icon: Clock,
    iconClassName: "bg-amber-100 text-amber-600",
  },
  [TOKEN_OUTCOMES.invalid]: {
    title: "Invalid link",
    description: "This activation link is invalid or has been revoked. Request a new link from your administrator.",
    Icon: XCircle,
    iconClassName: "bg-slate-100 text-slate-600",
  },
  [TOKEN_OUTCOMES.used]: {
    title: "Already activated",
    description: "This account has already been activated. Sign in with your credentials.",
    Icon: UserCheck,
    iconClassName: "bg-slate-100 text-slate-600",
  },
  [TOKEN_OUTCOMES.suspended]: {
    title: "Account suspended",
    description: "This account has been suspended. Contact your administrator.",
    Icon: Ban,
    iconClassName: "bg-red-100 text-red-600",
  },
};

export default function TokenProcessingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setValidationResult } = useActivation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token") ?? "";
    let cancelled = false;

    validateToken(token).then((res) => {
      if (cancelled) return;
      setStatus(res.status);
      setMessage(res.message ?? "");
      setUser(res.user ?? null);
      setValidationResult(res.status, res.message ?? "", res.user ?? null, token);
      setLoading(false);

      if (res.status === TOKEN_OUTCOMES.valid) {
        const t = setTimeout(() => navigate("/activate/confirm", { replace: true }), 1500);
        return () => clearTimeout(t);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, setValidationResult]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" aria-hidden />
          <p className="mt-4 text-sm font-medium text-slate-700">Verifying activation link…</p>
          <p className="mt-1 text-xs text-slate-500">Do not close this window.</p>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[TOKEN_OUTCOMES.invalid];
  const { title, description, Icon, iconClassName } = config;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <StatusCard
          title={title}
          description={description}
          icon={Icon}
          iconClassName={iconClassName}
          actions={
            status === TOKEN_OUTCOMES.valid ? null : (
              <>
                {status === TOKEN_OUTCOMES.used ? (
                  <Button className="w-full sm:w-auto" onClick={() => navigate("/login")}>
                    Sign in
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/login")}>
                    Return to sign in
                  </Button>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  );
}
