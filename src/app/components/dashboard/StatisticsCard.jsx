"use client";

import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "../../components/ui/utils";

function KpiHeader({ kpi, subtitle }) {
  if (!kpi && !subtitle) return null;
  return (
    <div className="space-y-0.5">
      {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
      {kpi ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</span>
          <span className="text-base font-bold text-foreground">{kpi.value}</span>
          {kpi.delta ? (
            <span
              className={cn(
                "text-[11px] font-medium",
                kpi.delta.startsWith("+") ? "text-[#00411A]" : kpi.delta.startsWith("-") ? "text-[#E84A25]" : "text-muted-foreground",
              )}
            >
              {kpi.delta}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StatisticsCard({
  title,
  to,
  children,
  className,
  variant = "default",
  subtitle,
  kpi,
  filterQuery,
}) {
  const navigate = useNavigate();
  const isAnalytics = variant === "analytics";
  const isBento = variant === "bento";

  const destination = to && filterQuery ? `${to}${to.includes("?") ? "&" : "?"}${filterQuery}` : to;

  return (
    <Card
      role={destination ? "button" : undefined}
      tabIndex={destination ? 0 : undefined}
      onClick={() => destination && navigate(destination)}
      onKeyDown={(e) => destination && (e.key === "Enter" || e.key === " ") && navigate(destination)}
      className={cn(
        "h-full gap-2 rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:ring-offset-2",
        destination && "cursor-pointer",
        isBento &&
          "border-[color:var(--border)] shadow-sm transition-all duration-200 hover:border-[#CEF445]/50 hover:shadow-md",
        isAnalytics &&
          "border-[color:var(--border)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CEF445]/60 hover:shadow-md",
        !isAnalytics && !isBento && "border-slate-200 transition-all hover:border-blue-300 hover:shadow-md focus:ring-blue-500",
        className,
      )}
      aria-label={destination ? `View ${title}` : undefined}
    >
      <CardHeader
        className={cn(
          "space-y-1 pb-1",
          isAnalytics || isBento ? "px-5 pt-5" : "pt-4",
        )}
      >
        <CardTitle
          className={cn(
            "flex items-center justify-between gap-2 text-sm font-semibold leading-snug line-clamp-2",
            isAnalytics || isBento ? "text-foreground" : "text-slate-900",
          )}
        >
          <span>{title}</span>
          {destination ? (
            <ExternalLink
              className={cn(
                "h-4 w-4 shrink-0",
                isAnalytics || isBento ? "text-muted-foreground" : "text-slate-400",
              )}
              aria-hidden
            />
          ) : null}
        </CardTitle>
        {(isAnalytics || isBento) && (kpi || subtitle) ? <KpiHeader kpi={kpi} subtitle={kpi ? undefined : subtitle} /> : null}
      </CardHeader>
      <CardContent className={cn("pt-0", (isAnalytics || isBento) && "px-5 pb-5")}>{children}</CardContent>
    </Card>
  );
}
