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

const SEVERITY_COLORS = ["#00411A", "#7CB342", "#FFD600", "#F59E0B", "#E84A25"];

/** Pro-rate total amount across status pie slices for the legend table. */
export function buildStatusTableRows(pie, totalAmount = 0) {
  if (!Array.isArray(pie) || !pie.length) return [];
  const total = pie.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const amount = Number(totalAmount) || 0;
  return pie.map((row) => {
    const count = Number(row.value) || 0;
    const share = total > 0 ? (count / total) * 100 : 0;
    const rowAmount = total > 0 ? (amount * count) / total : 0;
    return {
      name: row.name,
      count,
      share: share.toFixed(1),
      amount: rowAmount,
    };
  });
}

export function StatusLegendTable({ rows = [] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[color:var(--border)]">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-[color:var(--border)] bg-muted/40 text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 font-medium text-right">Count</th>
            <th className="px-2 py-1.5 font-medium text-right">%</th>
            <th className="px-2 py-1.5 font-medium text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-[color:var(--border)] last:border-0">
              <td className="px-2 py-1.5 font-medium text-foreground">{row.name}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatCountNg(row.count)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.share}%</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNairaFull(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Channel rows with share % for horizontal bar labels. */
export function prepareChannelRowsWithShare(channelRows) {
  if (!Array.isArray(channelRows) || !channelRows.length) return [];
  const total = channelRows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  return channelRows.map((row) => {
    const count = Number(row.count) || 0;
    const share = total > 0 ? (count / total) * 100 : 0;
    return {
      ...row,
      share,
      shareLabel: `${share.toFixed(1)}%`,
    };
  });
}

/** Top N institutions with severity coloring by failure rank. */
export function prepareInstitutionTopRows(rows, limit = 10) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const sorted = [...rows].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
  const top = sorted.slice(0, limit);
  const max = Number(top[0]?.count) || 1;
  return top.map((row, index) => {
    const ratio = (Number(row.count) || 0) / max;
    const colorIndex = Math.min(
      SEVERITY_COLORS.length - 1,
      Math.floor((1 - ratio) * (SEVERITY_COLORS.length - 1)),
    );
    return {
      ...row,
      fullName: row.name,
      name: truncateLabel(row.name, 22),
      fill: SEVERITY_COLORS[colorIndex] ?? SEVERITY_COLORS[SEVERITY_COLORS.length - 1],
      rank: index + 1,
    };
  });
}

/** Align prior-period trend to current buckets by day index (not calendar label). */
export function alignPriorTrendByIndex(currentRows, priorRows) {
  const prior = Array.isArray(priorRows) ? priorRows : [];
  return (currentRows || []).map((row, index) => ({
    ...row,
    priorTransactions:
      prior[index] != null ? Number(prior[index].transactions ?? prior[index].volume) || 0 : undefined,
  }));
}
