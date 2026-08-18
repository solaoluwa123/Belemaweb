"use client";

import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "../../components/ui/utils";

export function StatisticsCard({ title, to, children, className }) {
  const navigate = useNavigate();

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => to && navigate(to)}
      onKeyDown={(e) => to && (e.key === "Enter" || e.key === " ") && navigate(to)}
      className={cn(
        "h-full cursor-pointer gap-2 border-slate-200 bg-white transition-all hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
      aria-label={`View ${title}`}
    >
      <CardHeader className="space-y-0 pb-1 pt-4">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium leading-snug text-slate-900 line-clamp-2">
          <span>{title}</span>
          {to && <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
