"use client";

import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "../../components/ui/utils";

export function StatisticsCard({ title, to, children, className, variant = "default" }) {
  const navigate = useNavigate();
  const isAnalytics = variant === "analytics";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => to && navigate(to)}
      onKeyDown={(e) => to && (e.key === "Enter" || e.key === " ") && navigate(to)}
      className={cn(
        "h-full cursor-pointer gap-2 bg-card focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:ring-offset-2",
        isAnalytics
          ? "border-[color:var(--border)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CEF445]/60 hover:shadow-md"
          : "border-slate-200 transition-all hover:border-blue-300 hover:shadow-md focus:ring-blue-500",
        className,
      )}
      aria-label={`View ${title}`}
    >
      <CardHeader className={cn("space-y-0 pb-1", isAnalytics ? "pt-5 px-5" : "pt-4")}>
        <CardTitle
          className={cn(
            "flex items-center justify-between gap-2 text-sm font-semibold leading-snug line-clamp-2",
            isAnalytics ? "text-foreground" : "text-slate-900",
          )}
        >
          <span>{title}</span>
          {to ? (
            <ExternalLink
              className={cn("h-4 w-4 shrink-0", isAnalytics ? "text-muted-foreground" : "text-slate-400")}
              aria-hidden
            />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("pt-0", isAnalytics && "px-5 pb-5")}>{children}</CardContent>
    </Card>
  );
}
