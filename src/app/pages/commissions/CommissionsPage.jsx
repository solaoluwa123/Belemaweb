import { useEffect, useMemo, useState } from "react";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { DashboardDateRangePicker } from "../../components/dashboard/DashboardDateRangePicker";
import { StatisticsDrilldownLayout } from "../../components/dashboard/StatisticsDrilldownLayout";
import { useAuth } from "../../context/AuthContext";
import { APIError } from "../../services/api";
import { ALL_INSTITUTIONS_CODE, fetchCommissions } from "../../services/commissions";
import { defaultDashboardDateRange } from "../../services/dashboards";
import { fetchInstitutionsList } from "../../services/financialInstitutions";
import { formatCountNg, formatNairaFull } from "../../utils/dashboardChartUtils";
import { formatBackendDateTime } from "../../utils/formatters";

const EMPTY_SUMMARY = {
  rows: [],
  totalRecords: 0,
  totalCommission: 0,
  totalVat: 0,
  totalChargeAmount: 0,
};

/** Columns mirror `tbl_commission_paid` (exclude `id`; institution_code → name). */
const COMMISSION_TABLE_COLUMNS = [
  {
    header: "Institution",
    accessor: (r) => r.institutionName || r.institutionCode || "Unknown",
  },
  { header: "Total count", accessor: (r) => formatCountNg(r.totalCount) },
  {
    header: "Start date",
    accessor: (r) => formatBackendDateTime(r.startDate, { fallback: "—" }),
  },
  {
    header: "End date",
    accessor: (r) => formatBackendDateTime(r.endDate, { fallback: "—" }),
  },
  { header: "Charge amount", accessor: (r) => formatNairaFull(r.chargeAmount) },
  { header: "Total commission", accessor: (r) => formatNairaFull(r.totalCommission) },
  { header: "Total VAT", accessor: (r) => formatNairaFull(r.totalVat) },
  {
    header: "Income account credited",
    accessor: (r) => (r.incomeAccountCredited ? "Yes" : "No"),
  },
  {
    header: "Generation date",
    accessor: (r) => formatBackendDateTime(r.generationDate, { fallback: "—" }),
  },
  {
    header: "Paid date",
    accessor: (r) => formatBackendDateTime(r.paidDate, { fallback: "—" }),
  },
  { header: "Session ID", accessor: (r) => r.sessionId || "—" },
  { header: "Commission", accessor: (r) => formatNairaFull(r.commission) },
  { header: "Report location", accessor: (r) => r.reportLocation || "—" },
];

export default function CommissionsPage() {
  const { user, isThirdPartyVendor } = useAuth();
  const isVendor = isThirdPartyVendor();
  const vendorCode = String(user?.institutionCode || "").trim();
  const vendorLabel = user?.institutionName || vendorCode;
  const vendorUnlinked = isVendor && !vendorCode;

  const [dateRange, setDateRange] = useState(() => defaultDashboardDateRange(30));
  const [selectedCode, setSelectedCode] = useState(ALL_INSTITUTIONS_CODE);
  const [institutions, setInstitutions] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(!vendorUnlinked);
  const [errorMessage, setErrorMessage] = useState("");

  const institutionCode = isVendor ? vendorCode : selectedCode;

  useEffect(() => {
    if (isVendor) return;
    let cancelled = false;
    fetchInstitutionsList({ activeOnly: true })
      .then((list) => {
        if (!cancelled) setInstitutions(list);
      })
      .catch(() => {
        if (!cancelled) setInstitutions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isVendor]);

  const loadPage = async () => {
    if (vendorUnlinked) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchCommissions({
        institutionCode,
        dateRange,
        requireInstitutionScope: isVendor,
      });
      setSummary(data);
    } catch (error) {
      setSummary(EMPTY_SUMMARY);
      setErrorMessage(error instanceof APIError ? error.message : "Unable to load commissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [institutionCode, dateRange.start?.getTime(), dateRange.end?.getTime(), vendorUnlinked]);

  const institutionLabel = useMemo(() => {
    if (isVendor) return vendorLabel || "Your institution";
    if (institutionCode === ALL_INSTITUTIONS_CODE) return "All institutions";
    return institutions.find((item) => item.code === institutionCode)?.name ?? institutionCode;
  }, [isVendor, vendorLabel, institutionCode, institutions]);

  const controls = (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      {isVendor ? (
        <div className="min-w-0 space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Financial institution</Label>
          <p className="text-sm font-medium text-slate-900">{vendorLabel || "Not linked"}</p>
        </div>
      ) : (
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="commissions-institution" className="text-sm font-medium text-slate-700">
            Financial institution
          </Label>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger id="commissions-institution" className="w-full min-w-0 sm:w-[220px]">
              <SelectValue placeholder="All institutions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_INSTITUTIONS_CODE}>All institutions</SelectItem>
              {institutions.map((item) => (
                <SelectItem key={item.id} value={item.code}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <DashboardDateRangePicker
        id="commissions-date-range"
        label="Date range"
        value={dateRange}
        onChange={setDateRange}
        className="min-w-0 sm:min-w-[240px]"
      />
    </div>
  );

  return (
    <StatisticsDrilldownLayout
      title="Commissions"
      subtitle="Paid commission records from settlement runs."
      dateRange={dateRange}
      institutionLabel={institutionLabel}
      isLoading={isLoading}
      errorMessage={vendorUnlinked ? "Your account is not linked to an institution." : errorMessage}
      onRefresh={loadPage}
      showBack={false}
      controls={controls}
      csvFilename="commissions.csv"
      tableColumns={COMMISSION_TABLE_COLUMNS}
      tableRows={summary.rows}
      emptyMessage={
        vendorUnlinked
          ? "Commissions become available once your account is linked to an institution."
          : "No commissions were generated for this period."
      }
    />
  );
}
