import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const INFLOW_COLOR = "#00411A";
const OUTFLOW_COLOR = "#E84A25";

export function RateChartPanel({ institution, compact = false }) {
  const { name, timeSeries, inflowSuccess, inflowFailure, outflowSuccess, outflowFailure, yAxisDomain } =
    institution;
  const domain = yAxisDomain ?? [0, 80];
  const chartHeight = compact ? 150 : 180;

  return (
    <Card className="h-full gap-2 border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="space-y-0 pb-1 pt-4">
        <CardTitle className="truncate text-sm font-medium text-slate-900" title={name}>
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: INFLOW_COLOR }} aria-hidden />
            Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: OUTFLOW_COLOR }} aria-hidden />
            Outflow
          </span>
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={timeSeries} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px", border: "1px solid #e2e8f0", borderRadius: "6px" }}
              formatter={(value) => [`${value}%`, null]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend wrapperStyle={{ display: "none" }} formatter={() => null} />
            {domain[1] > 10 ? (
              <>
                <ReferenceLine y={40} stroke="#E84A25" strokeWidth={1} strokeDasharray="4 4" />
                <ReferenceLine y={80} stroke="#00411A" strokeWidth={1} strokeDasharray="4 4" />
              </>
            ) : null}
            <Line
              type="monotone"
              dataKey="inflow"
              name="Inflow"
              stroke={INFLOW_COLOR}
              strokeWidth={2}
              dot={{ fill: INFLOW_COLOR, r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="outflow"
              name="Outflow"
              stroke={OUTFLOW_COLOR}
              strokeWidth={2}
              dot={{ fill: OUTFLOW_COLOR, r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-x-4 text-[10px] text-slate-600">
          <div className="flex flex-col gap-0.5">
            <div>Inflow Success: {inflowSuccess}%</div>
            <div>Inflow Failure: {inflowFailure}%</div>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <div>Outflow Success: {outflowSuccess}%</div>
            <div>Outflow Failure: {outflowFailure}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
