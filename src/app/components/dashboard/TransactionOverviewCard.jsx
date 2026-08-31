"use client";

import { useNavigate } from "react-router";
import { Banknote } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { STATUS_PIE_COLORS } from "../../services/dashboards";
import { CHART_ANIMATION, CHART_TOOLTIP_STYLE } from "./DashboardMotion";

function pieTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
}

function findPieValue(rows, name) {
  const row = (rows || []).find((r) => r.name === name);
  return row ? Number(row.value) || 0 : 0;
}

export function TransactionOverviewCard({ metrics, successFailurePie, className }) {
  const navigate = useNavigate();
  const pieData = successFailurePie?.length ? successFailurePie : [];
  const total = pieTotal(pieData) || Number(metrics?.totalTransactions?.replace?.(/,/g, "") ?? metrics?.totalTransactions) || 0;

  const legendItems = [
    { name: "Successful", value: findPieValue(pieData, "Successful"), color: STATUS_PIE_COLORS.Successful },
    { name: "Pending", value: findPieValue(pieData, "Pending"), color: STATUS_PIE_COLORS.Pending },
    { name: "Failed", value: findPieValue(pieData, "Failed"), color: STATUS_PIE_COLORS.Failed },
    {
      name: "Failed / Other",
      value: findPieValue(pieData, "Failed / Other"),
      color: STATUS_PIE_COLORS.Failed,
    },
  ].filter((item, index, arr) => {
    if (item.name === "Failed / Other" && arr.some((x) => x.name === "Failed" && x.value > 0)) return false;
    return item.value > 0 || ["Successful", "Pending", "Failed"].includes(item.name);
  });

  const displayLegend = legendItems.filter((item) => item.name !== "Failed / Other").slice(0, 4);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate("/dashboard/statistics/successful-transactions")}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/dashboard/statistics/successful-transactions")}
      className={`h-full cursor-pointer rounded-xl border-[color:var(--border)] bg-card shadow-sm transition-all hover:border-[#CEF445]/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)] ${className || ""}`}
    >
      <CardHeader className="space-y-0 px-5 pb-2 pt-5">
        <CardTitle className="text-base font-semibold text-foreground">Transaction Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-[180px] w-[180px] shrink-0 sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length ? pieData : [{ name: "No data", value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                  {...CHART_ANIMATION}
                >
                  {(pieData.length ? pieData : [{ name: "No data", value: 1 }]).map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === "No data"
                          ? "#eef8c8"
                          : STATUS_PIE_COLORS[entry.name] ?? ["#00411A", "#CEF445", "#FFD600", "#E84A25"][index % 4]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [Number(v).toLocaleString(), "Count"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-2xl font-bold text-foreground">{Number(total).toLocaleString()}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total Transactions</p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-[#eef8c8] px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#CEF445] text-[#00411A]">
                <Banknote className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00411A]/70">Transaction Value</p>
                <p className="text-xl font-bold text-[#00411A]">{metrics?.volume ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {displayLegend.map((item) => (
            <div key={item.name} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                <p className="text-sm font-semibold text-foreground">{item.value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
