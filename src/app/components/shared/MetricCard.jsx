import { Card, CardContent } from "../ui/card";
import { cn } from "../ui/utils";

const ICON_BG = {
  primary: "bg-[#eef8c8] text-[#00411A]",
  lime: "bg-[#eef8c8] text-[#00411A]",
  yellow: "bg-[#fff9db] text-[#00411A]",
  burgundy: "bg-[#f5eef2] text-[#410027]",
  orange: "bg-[#fff0eb] text-[#E84A25]",
};

function GaugeRing({ value, size = 72 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute inset-0 m-auto" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#eef8c8"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#CEF445"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  footerTrend = false,
  gauge,
  iconAccent = "lime",
  size = "default",
  className,
}) {
  const iconBg = ICON_BG[iconAccent] || ICON_BG.lime;
  const isCompact = size === "compact";
  const showGauge = gauge !== undefined && gauge !== null && !Number.isNaN(Number(gauge));

  const trendPill = trend ? (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        trend.isPositive ? "bg-[#eef8c8] text-[#00411A]" : "bg-[#fff0eb] text-[#E84A25]",
      )}
    >
      {trend.isPositive ? "↑" : "↓"} {trend.value}
    </span>
  ) : null;

  return (
    <Card
      className={cn(
        "h-full w-full gap-0 rounded-xl border-[color:var(--border)] bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardContent
        className={cn(
          "flex h-full min-h-[7.5rem] flex-col justify-between",
          isCompact ? "px-4 pb-4 pt-4" : "px-5 pb-5 pt-5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <div
              className={cn(
                "relative font-bold leading-none tracking-tight text-foreground",
                isCompact ? "text-2xl" : "text-3xl",
                showGauge && !isCompact && "flex h-[72px] w-[72px] items-center justify-center",
              )}
            >
              {showGauge && !isCompact ? <GaugeRing value={gauge} /> : null}
              <span className={showGauge && !isCompact ? "relative z-10 text-xl" : undefined}>{value}</span>
            </div>
            {subtitle ? <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p> : null}
            {trend && !footerTrend ? trendPill : null}
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl",
                isCompact ? "h-9 w-9" : "h-11 w-11",
                iconBg,
              )}
              aria-hidden
            >
              <Icon className={isCompact ? "h-4 w-4" : "h-5 w-5"} />
            </div>
          ) : null}
        </div>
        {trend && footerTrend ? <div className="mt-3 border-t border-[color:var(--border)] pt-3">{trendPill}</div> : null}
      </CardContent>
    </Card>
  );
}
