import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../ui/utils";

export function MetricCard({ title, value, icon: Icon, subtitle, trend, iconColor = "text-primary", className }) {
  return (
    <Card
      className={cn(
        "w-full gap-0 self-start border-slate-200",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-1.5 pt-4">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden />
      </CardHeader>
      <CardContent className="px-6 pb-4 pt-0">
        <div className="flex flex-col gap-0.5">
          <div className="text-2xl font-bold leading-tight tracking-tight">{value}</div>
          {subtitle ? <p className="text-xs leading-snug text-gray-500">{subtitle}</p> : null}
          {trend ? (
            <p className={`text-xs leading-snug ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}