"use client";

import { useEffect, useMemo, useState } from "react";
import { StatisticsCard } from "./StatisticsCard";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Calendar, CALENDAR_YEAR_MIN, CALENDAR_YEAR_MAX } from "../../components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Loader2, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TRANSGATE_BANKS } from "../../data/mockData";
import { useBrand } from "../../../branding/useBrand";
import { fetchAccountsDashboardData } from "../../services/dashboards";
import { APIError } from "../../services/api";

export function StatisticsSection({
  statsInstitution: controlledInstitution,
  onInstitutionChange,
  statsDate: controlledDate,
  onDateChange,
  statsData,
  isLoading: controlledLoading,
  errorMessage: controlledError,
  lockInstitution = false,
  institutionDisplayName,
}) {
  const { brand } = useBrand();
  const [internalInstitution, setInternalInstitution] = useState("all");
  const [internalDate, setInternalDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const institution = controlledInstitution !== undefined ? controlledInstitution : internalInstitution;
  const setInstitution = onInstitutionChange ?? setInternalInstitution;
  const date = controlledDate !== undefined ? controlledDate : internalDate;
  const setDate = onDateChange ?? setInternalDate;

  const handleDateSelect = (d) => {
    if (d instanceof Date && !isNaN(d.getTime())) {
      setDate(d);
      setDatePickerOpen(false);
    }
  };

  const [internalStats, setInternalStats] = useState(null);
  const [internalLoading, setInternalLoading] = useState(controlledLoading ?? true);
  const [internalError, setInternalError] = useState("");

  const loadStatistics = async () => {
    if (statsData) return;

    setInternalLoading(true);
    setInternalError("");
    try {
      const data = await fetchAccountsDashboardData({
        institutionCode: institution !== "all" ? institution : null,
        date,
      });
      setInternalStats(data);
    } catch (error) {
      const message = error instanceof APIError ? error.message : "Unable to load dashboard statistics.";
      setInternalStats(null);
      setInternalError(message);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (statsData) return;
    loadStatistics();
  }, [statsData, institution, date]);

  const stats = useMemo(() => {
    return (
      statsData ??
      internalStats ?? {
        successVolumes7d: [],
        failedTop5Codes: [],
        transactionsByChannel: [],
        failureByInstitution: [],
        averageTime: { ne: 0, ft: 0 },
      }
    );
  }, [statsData, internalStats]);
  const {
    successVolumes7d,
    failedTop5Codes,
    transactionsByChannel,
    failureByInstitution,
    averageTime,
    hasTransactions,
  } = stats;
  const chartColors = brand.theme.chart;
  const isLoading = controlledLoading ?? internalLoading;
  const errorMessage = controlledError ?? internalError;
  const showCharts =
    !isLoading &&
    !errorMessage &&
    (hasTransactions !== false) &&
    (hasTransactions === true ||
      successVolumes7d.length > 0 ||
      failedTop5Codes.length > 0 ||
      transactionsByChannel.length > 0 ||
      failureByInstitution.length > 0);

  return (
    <section className="space-y-6" aria-labelledby="statistics-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="statistics-heading" className="text-2xl font-bold text-slate-900">
          Statistics
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {!statsData ? (
            <Button variant="outline" onClick={loadStatistics} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        {lockInstitution ? (
          <div className="min-w-0 space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Source financial institution</Label>
            <p className="text-sm font-medium text-slate-900">{institutionDisplayName || institution}</p>
          </div>
        ) : (
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="stat-institution" className="text-sm font-medium text-slate-700">
              Source Financial Institutions*
            </Label>
            <Select value={institution} onValueChange={setInstitution}>
              <SelectTrigger id="stat-institution" className="w-full min-w-0 sm:w-[180px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {TRANSGATE_BANKS.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="stat-date" className="text-sm font-medium text-slate-700">
            Date
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                id="stat-date"
                variant="outline"
                className="w-full min-w-0 justify-start text-left font-normal sm:w-[200px]"
                aria-expanded={datePickerOpen}
                aria-haspopup="dialog"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">{date ? format(date, "MMMM d, yyyy") : "Pick date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(100vw-2rem,22rem)] max-w-full p-0 sm:w-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                defaultMonth={date}
                captionLayout="dropdown"
                fromYear={CALENDAR_YEAR_MIN}
                toYear={CALENDAR_YEAR_MAX}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading statistics...
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && !showCharts ? (
        <div className="rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600">
          No transactions for {date ? format(date, "MMMM d, yyyy") : "this day"}.
        </div>
      ) : null}

      {showCharts ? (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatisticsCard title="Successful Transactions Volumes" to="/dashboard/statistics/successful-transactions">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={successVolumes7d} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis width={36} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="volume" stroke={chartColors[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </StatisticsCard>

        <StatisticsCard title="Average Time" to="/dashboard/statistics/average-time">
          <div className="flex flex-col gap-1 py-1 text-slate-700">
            <p className="text-sm font-medium">NE: {averageTime?.ne ?? 0}secs</p>
            <p className="text-sm font-medium">FT: {Number(averageTime?.ft || 0).toFixed(2)}secs</p>
          </div>
        </StatisticsCard>

        <StatisticsCard title="Failed Transactions (Top 5 Codes) Volumes" to="/dashboard/statistics/failed-codes">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={failedTop5Codes.slice(0, 3)} layout="vertical" margin={{ top: 5, right: 5, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="code" width={55} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="count" fill={chartColors[1]} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </StatisticsCard>

        <StatisticsCard title="Transactions by Channels" to="/dashboard/statistics/by-channel">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={transactionsByChannel} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="channel" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={45} />
              <YAxis width={42} tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)} />
              <Tooltip formatter={(v) => [v.toLocaleString(), "Count"]} />
              <Bar dataKey="count" fill={chartColors[2]} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </StatisticsCard>

        <StatisticsCard title="Failure rates by Institution" to="/dashboard/statistics/by-institution" className="sm:col-span-2 lg:col-span-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={failureByInstitution} layout="vertical" margin={{ top: 5, right: 5, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="count" name="Failures" radius={[0, 2, 2, 0]}>
                {failureByInstitution.map((entry) => (
                  <Cell key={entry.name || entry.institutionCode} fill={entry.fill || chartColors[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </StatisticsCard>
      </div>
      ) : null}
    </section>
  );
}
