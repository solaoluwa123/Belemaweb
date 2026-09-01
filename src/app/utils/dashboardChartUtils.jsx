/** Compact axis tick formatter (1.2k, 1.5M). */
export function formatCompactCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatCountNg(value) {
  return Number(value || 0).toLocaleString("en-NG");
}

export function formatNaira(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "₦0";
  if (Math.abs(n) >= 1e9) return `₦${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `₦${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `₦${(n / 1e3).toFixed(1)}k`;
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatNairaFull(value) {
  return `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Truncate label for chart axes. */
export function truncateLabel(text, max = 18) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function ChartEmptyState({ message = "No data for this period" }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Custom Recharts label for donut center (total + success %). */
export function DonutCenterLabel({ viewBox, total, successPct }) {
  if (!viewBox || typeof viewBox.cx !== "number") return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} y={cy - 6} fill="var(--foreground, #1f2937)" fontSize={16} fontWeight={700}>
        {formatCountNg(total)}
      </tspan>
      <tspan x={cx} y={cy + 14} fill="var(--muted-foreground, #64748b)" fontSize={10}>
        {successPct}% success
      </tspan>
    </text>
  );
}

export function formatDeltaPct(current, prior) {
  const c = Number(current);
  const p = Number(prior);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  const pct = ((c - p) / p) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}% vs prior`, positive: pct >= 0 };
}
