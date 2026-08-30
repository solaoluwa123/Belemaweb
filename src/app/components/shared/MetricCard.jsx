import { Card, CardContent } from "../ui/card";
import { cn } from "../ui/utils";

const ICON_BG = {
  primary: "bg-[#eef8c8] text-[#00411A]",
  lime: "bg-[#eef8c8] text-[#00411A]",
  yellow: "bg-[#fff9db] text-[#00411A]",
  burgundy: "bg-[#f5eef2] text-[#410027]",
  orange: "bg-[#fff0eb] text-[#E84A25]",
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  iconAccent = "lime",
  className,
}) {
  const iconBg = ICON_BG[iconAccent] || ICON_BG.lime;

  return (
    <Card
      className={cn(
        "w-full gap-0 self-start border-[color:var(--border)] bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardContent className="px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <div className="text-3xl font-bold leading-none tracking-tight text-foreground">{value}</div>
            {subtitle ? (
              <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
            ) : null}
            {trend ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  trend.isPositive
                    ? "bg-[#eef8c8] text-[#00411A]"
                    : "bg-[#fff0eb] text-[#E84A25]",
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
            ) : null}
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                iconBg,
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
