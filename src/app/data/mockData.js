import { getActiveBrandConfig } from "../../branding/brandRuntime";

// Mock data for the application

export const mockTransactions = [
  {
    id: "TXN001",
    date: "2026-03-02T10:30:00",
    amount: 150000,
    from: "ACC12345",
    to: "ACC67890",
    status: "Success",
    type: "Transfer",
    reference: "REF001",
    institutionId: "INST001",
  },
  {
    id: "TXN002",
    date: "2026-03-02T11:15:00",
    amount: 75000,
    from: "ACC23456",
    to: "ACC78901",
    status: "Pending",
    type: "Transfer",
    reference: "REF002",
    institutionId: "INST002",
  },
  {
    id: "TXN003",
    date: "2026-03-02T12:00:00",
    amount: 200000,
    from: "ACC34567",
    to: "ACC89012",
    status: "Failed",
    type: "Transfer",
    reference: "REF003",
    institutionId: "INST001",
  },
];

// Total Transactions table (switching platform layout)
function txRand(seed) {
  // xorshift32 (deterministic, fast)
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function pick(arr, r) {
  return arr[Math.floor(r * arr.length)] ?? arr[0];
}

function pad(n, len) {
  return String(n).padStart(len, "0");
}

function makeSessionId(i) {
  return `SID-${pad(20260306, 8)}-${pad(i + 1, 4)}-${pad((i * 37) % 10000, 4)}`;
}

function makePaymentRef(i) {
  return `PAY-${pad(202603, 6)}-${pad((i + 1) * 97, 6)}`;
}

const TX_CHANNELS = [
  "Internet Banking",
  "Mobile App",
  "USSD",
  "POS",
  "ATM",
  "Branch",
  "API",
];

const TX_BANKS = [
  "GTBank",
  "Access Bank",
  "UBA",
  "FCMB",
  "First Bank",
  "Zenith Bank",
  "Union Bank",
  "Stanbic IBTC",
  "OPAY",
  "MONIEPOINT",
  "KUDA MFB",
  "PalmPay",
  "Fidelity Bank",
  "Sterling Bank",
  "Wema Bank",
  "Polaris Bank",
  "Keystone Bank",
  "Heritage Bank",
  "Providus Bank",
  "Titan Trust Bank",
];

const TX_DEST_NODES = [
  "HabariPay",
  "NIP",
  "CoralPay",
  "NIBSS",
  getActiveBrandConfig().displayName,
  "Interswitch",
  "Remita",
  "Paystack",
  "Flutterwave",
];

const TX_STATUSES = ["Successful", "Pending", "Failed"];

const TX_NAMES = [
  "IME LINUS IBANGA",
  "ADESHEWA ADUNNI OGBE",
  "FOLORUNSO ALABI",
  "ALICE ADUGO ONABAJO",
  "JOHN OKONKWO",
  "BLESSING CHINEDU",
  "SAMUEL ADELEKE",
  "MARIAM BELLO",
  "KELVIN EMEKA",
  "FATIMA IBRAHIM",
  "OLUWASEUN AKINOLA",
  "CHINENYE OKAFOR",
  "ADAEZE NWANKWO",
  "CHUKWUDI OKOLIE",
  "AMINA MOHAMMED",
  "BENJAMIN EZE",
  "GRACE OBI",
  "YUSUF ABDUL",
  "NKECHI NWOSU",
  "OLUMIDE ADEBAYO",
  "ZAINAB USMAN",
  "IFEANYI OKONKWO",
  "CHIOMA EZEKWEM",
  "DAVID OLANREWAJU",
  "SADE OGUNLEYE",
  "EMEKA NWOSU",
  "FUNKE AKINDELE",
  "IBRAHIM SANI",
  "NGOZI OKAFOR",
  "TAIWO ADENIRAN",
  "KEHINDE BALOGUN",
  "RUKAYAT YUSUF",
  "OSAGIE IYARE",
  "AMARA EZE",
  "BUKOLA ADEBAYO",
  "CHIBUEZE OKOLI",
  "HALIMA ABUBAKAR",
  "SEGUN OWOLABI",
  "CHIAMAKA NWABUEZE",
  "KUNLE ADESANYA",
  "FOLAKEMI OGUNLESI",
  "DANJUMA IBRAHIM",
  "CHINWE OBI",
  "ADEBAYO FASHOLA",
  "ZAINAB BALA",
  "OBINNA EZEIGBO",
  "BIMBO AKANDE",
  "MUSA YAKUBU",
  "NNEKA OKORO",
  "TUNDE BAKARE",
  "AMINA LAWAL",
];

function pickFromExcluding(arr, r, excludeSet) {
  const allowed = arr.filter((x) => !excludeSet.has(x));
  return allowed[Math.floor(r * allowed.length)] ?? allowed[0];
}

function makeMockTotalTransactions(count = 75) {
  const base = new Date("2026-03-06T18:30:00");
  const rows = [];

  for (let i = 0; i < count; i++) {
    const r1 = txRand(1000 + i * 17);
    const r2 = txRand(2000 + i * 29);
    const r3 = txRand(3000 + i * 43);
    const r4 = txRand(4000 + i * 59);
    const r5 = txRand(5000 + i * 31);
    const r6 = txRand(6000 + i * 11);
    const r7 = txRand(7000 + i * 13);

    const statusRand = txRand(10000 + i * 7);
    const status =
      statusRand < 0.82
        ? "Successful"
        : statusRand < 0.94
          ? "Pending"
          : "Failed";
    const channel = pick(TX_CHANNELS, r2);
    const nBanks = TX_BANKS.length;
    const sourceBankIdx = Math.floor(r3 * nBanks);
    const beneficiaryBankIdx = (sourceBankIdx + 1 + Math.floor(r4 * (nBanks - 1))) % nBanks;
    const sourceBank = TX_BANKS[sourceBankIdx];
    const beneficiaryBank = TX_BANKS[beneficiaryBankIdx];
    const destinationNode = pick(TX_DEST_NODES, r5);

    const prevSource = i > 0 ? rows[i - 1].sourceAccountName : null;
    const prevBeneficiary = i > 0 ? rows[i - 1].beneficiaryAccountName : null;
    const excludeForSource = new Set(prevSource ? [prevSource] : []);
    const sourceAccountName = pickFromExcluding(TX_NAMES, r6, excludeForSource);
    const excludeForBeneficiary = new Set([sourceAccountName].concat(prevBeneficiary ? [prevBeneficiary] : []));
    const beneficiaryAccountName = pickFromExcluding(TX_NAMES, r7, excludeForBeneficiary);

    const amount = Math.round((5000 + txRand(8000 + i * 19) * 950000) / 100) * 100; // ₦5k – ₦955k
    const ftDurationMs = Math.max(40, Math.round(120 + txRand(9000 + i * 23) * 4800)); // 120ms–~5s

    const dateTime = new Date(base.getTime() - i * 7 * 60 * 1000).toISOString();

    rows.push({
      id: `TT${pad(i + 1, 4)}`,
      sessionId: makeSessionId(i),
      channelCode: channel,
      sourceAccountName,
      sourceBank,
      beneficiaryAccountName,
      beneficiaryBank,
      destinationNode,
      amount,
      status,
      ftDurationMs,
      dateTime,
      paymentReferenceNo: makePaymentRef(i),
    });
  }

  return rows;
}

export const mockTotalTransactions = makeMockTotalTransactions(85);

export const mockTotalTransactionsSummary = {
  totalCount: mockTotalTransactions.length,
  totalValue: mockTotalTransactions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
};

export const mockDisputes = [
  {
    id: "DIS001",
    transactionId: "TXN001",
    submittedBy: "user@example.com",
    submittedDate: "2026-03-01T14:30:00",
    reason: "Unauthorized transaction",
    status: "Pending",
    amount: 150000,
    institutionId: "INST001",
  },
  {
    id: "DIS002",
    transactionId: "TXN003",
    submittedBy: "admin@bank.com",
    submittedDate: "2026-03-01T15:00:00",
    reason: "Incorrect amount",
    status: "Approved",
    amount: 200000,
    institutionId: "INST002",
  },
];

export const mockWallets = [
  {
    id: "WAL001",
    accountNumber: "ACC12345",
    accountName: "John Doe",
    balance: 500000,
    currency: "NGN",
    status: "Active",
    institutionId: "INST001",
    createdDate: "2026-01-15",
  },
  {
    id: "WAL002",
    accountNumber: "ACC67890",
    accountName: "Jane Smith",
    balance: 750000,
    currency: "NGN",
    status: "Active",
    institutionId: "INST002",
    createdDate: "2026-02-01",
  },
];

export const mockApprovals = [
  {
    id: "APR001",
    type: "User",
    submittedBy: "admin@system.com",
    submittedDate: "2026-03-02T09:00:00",
    details: "New user registration: john.doe@example.com",
    status: "Pending",
    institutionId: "INST001",
  },
  {
    id: "APR002",
    type: "Wallet",
    submittedBy: "manager@bank.com",
    submittedDate: "2026-03-02T10:00:00",
    details: "Wallet creation for ACC99999",
    status: "Pending",
    institutionId: "INST002",
  },
  {
    id: "APR003",
    type: "User",
    submittedBy: `operator@${getActiveBrandConfig().mockBrand.emailDomain}`,
    submittedDate: "2026-03-02T11:30:00",
    details: `New user: approver2@${getActiveBrandConfig().mockBrand.emailDomain}`,
    status: "Approved",
    institutionId: "INST001",
  },
  {
    id: "APR004",
    type: "Institution",
    submittedBy: `operator@${getActiveBrandConfig().mockBrand.emailDomain}`,
    submittedDate: "2026-03-02T14:00:00",
    details: "New institution: Microfinance XYZ",
    status: "Pending",
    institutionId: "INST003",
  },
  {
    id: "APR005",
    type: "Wallet",
    submittedBy: `operator@${getActiveBrandConfig().mockBrand.emailDomain}`,
    submittedDate: "2026-03-02T15:00:00",
    details: "Wallet link request for ACC88888",
    status: "Rejected",
    institutionId: "INST001",
  },
];

export const mockResponseCodes = [
  { code: "00", description: "Approved", count: 1250 },
  { code: "05", description: "Do not honor", count: 45 },
  { code: "51", description: "Insufficient funds", count: 78 },
  { code: "91", description: "Issuer unavailable", count: 23 },
  { code: "96", description: "System error", count: 12 },
];

export const mockChartData = [
  { date: "Feb 24", transactions: 245, amount: 12500000 },
  { date: "Feb 25", transactions: 289, amount: 14200000 },
  { date: "Feb 26", transactions: 312, amount: 15800000 },
  { date: "Feb 27", transactions: 267, amount: 13100000 },
  { date: "Feb 28", transactions: 298, amount: 14900000 },
  { date: "Mar 01", transactions: 334, amount: 16700000 },
  { date: "Mar 02", transactions: 356, amount: 17900000 },
];

// Statistics dashboard: Last 7 days successful transaction volumes (normalized 0–1)
export const mockSuccessVolumes7d = [
  { date: "Feb 28", volume: 0.72 },
  { date: "Mar 01", volume: 0.78 },
  { date: "Mar 02", volume: 0.85 },
  { date: "Mar 03", volume: 0.82 },
  { date: "Mar 04", volume: 0.88 },
];

// Failed transactions: top 5 return codes (horizontal bar)
export const mockFailedTop5Codes = [
  { code: "RC - 61", description: "Exceeds withdrawal limit", count: 4980, fill: "#3b82f6" },
  { code: "RC - 07", description: "Do not honor", count: 680, fill: "#f97316" },
  { code: "RC - 25", description: "Unable to locate", count: 620, fill: "#eab308" },
  { code: "RC - 13", description: "Invalid amount", count: 450, fill: "#22c55e" },
  { code: "RC - 05", description: "Declined", count: 280, fill: "#ef4444" },
];

// Transactions by channel (vertical bar)
export const mockTransactionsByChannel = [
  { channel: "Bank Teller", count: 120000, fill: "#3b82f6" },
  { channel: "Internet Banking", count: 1520000, fill: "#3b82f6" },
  { channel: "Mobile Phone", count: 3850000, fill: "#3b82f6" },
  { channel: "3rd Party Platform", count: 80000, fill: "#3b82f6" },
  { channel: "USSD", count: 180000, fill: "#3b82f6" },
];

// Failure rates by institution (horizontal bar) – click institution for detail
export const mockFailureByInstitution = [
  { name: "Opay Ltd", count: 3480, fill: "#06b6d4" },
  { name: "MoniePoint", count: 2180, fill: "#3b82f6" },
  { name: "GTB", count: 1520, fill: "#f97316" },
  { name: "PalmPay", count: 980, fill: "#22c55e" },
  { name: "Fincra", count: 420, fill: "#8b5cf6" },
  { name: "BOLD", count: 280, fill: "#ef4444" },
  { name: "FairMoney", count: 190, fill: "#eab308" },
  { name: "HabariPaySquad", count: 95, fill: "#64748b" },
  { name: "TTMFB", count: 72, fill: "#64748b" },
  { name: "ZEDVANCE", count: 58, fill: "#64748b" },
  { name: "Haggai Mortgage Bank Limited", count: 42, fill: "#64748b" },
  { name: "SMARTCASH", count: 28, fill: "#64748b" },
  { name: "Wingtip", count: 18, fill: "#64748b" },
  { name: "HorizonPay", count: 12, fill: "#64748b" },
  { name: "Capricorn", count: 8, fill: "#64748b" },
];

// Transgate dashboard: bank filter options (enterprise)
export const TRANSGATE_BANKS = [
  { id: "all", name: "All" },
  { id: "opay", name: "OPAY" },
  { id: "moniepoint", name: "MONIEPOINT" },
  { id: "fcmb", name: "FCMB" },
  { id: "uba", name: "UBA" },
  { id: "access", name: "ACCESS BANK" },
  { id: "gtb", name: "GTB" },
  { id: "kuda", name: "KUDA MFB" },
  { id: "firstbank", name: "FIRST BANK" },
];

// Deterministic seed from bankId + date for mock variation
function transgateSeed(bankId, date) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
  const bankHash = (bankId || "all").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (datePart + bankHash * 7) % 1000;
}

// Base 7-day labels (relative to a given date)
function getLast7DaysLabels(date) {
  const d = date instanceof Date ? date : new Date(date);
  const labels = [];
  const fmt = (x) => x.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(day.getDate() - i);
    labels.push(fmt(day));
  }
  return labels;
}

/**
 * Transgate stats for a given bank and date (statistics + metrics + charts).
 * Used by dashboard/transgate and StatisticsSection.
 */
export function getTransgateStats(bankId, date) {
  const seed = transgateSeed(bankId, date);
  const base = 0.7 + (seed / 2000);
  const dayLabels = getLast7DaysLabels(date);

  const successVolumes7d = dayLabels.map((dateLabel, i) => ({
    date: dateLabel,
    volume: Math.min(1, Math.max(0.1, base * (0.85 + (i * 0.02)) + (seed % 50) / 500)),
  }));

  const failedCodesBase = [
    { code: "RC - 61", description: "Exceeds withdrawal limit", count: 4980, fill: "#3b82f6" },
    { code: "RC - 07", description: "Do not honor", count: 680, fill: "#f97316" },
    { code: "RC - 25", description: "Unable to locate", count: 620, fill: "#eab308" },
    { code: "RC - 13", description: "Invalid amount", count: 450, fill: "#22c55e" },
    { code: "RC - 05", description: "Declined", count: 280, fill: "#ef4444" },
  ];
  const failedMult = 0.6 + (seed % 40) / 100;
  const mockFailedTop5Codes = failedCodesBase.map((r) => ({
    ...r,
    count: Math.round(r.count * failedMult),
  }));

  const channelsBase = [
    { channel: "Bank Teller", count: 120000 },
    { channel: "Internet Banking", count: 1520000 },
    { channel: "Mobile Phone", count: 3850000 },
    { channel: "3rd Party Platform", count: 80000 },
    { channel: "USSD", count: 180000 },
  ];
  const channelMult = 0.75 + (seed % 35) / 100;
  const mockTransactionsByChannel = channelsBase.map((r) => ({
    ...r,
    count: Math.round(r.count * channelMult),
    fill: "#3b82f6",
  }));

  const institutionNames = TRANSGATE_BANKS.filter((b) => b.id !== "all").map((b) => b.name);
  const fills = ["#06b6d4", "#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#ef4444", "#eab308", "#64748b"];
  const failureBase = [3480, 2180, 1520, 980, 420, 280, 190, 95];
  const failMult = 0.5 + (seed % 60) / 100;
  const mockFailureByInstitution = institutionNames.map((name, i) => ({
    name,
    count: Math.round((failureBase[i] ?? 200) * failMult),
    fill: fills[i % fills.length],
  }));

  const totalTransactions = Math.round(2300 + (seed % 400));
  const volumeM = (105 + (seed % 25)) / 10;
  const successRate = (92 + (seed % 8)) / 100;
  const pendingDisputes = 8 + (seed % 10);

  const chartData7d = dayLabels.map((dateLabel, i) => ({
    date: dateLabel,
    transactions: Math.round(250 + (seed % 150) + i * 15),
    amount: Math.round((12 + (seed % 8) + i) * 1000000),
  }));

  const responseCodesBase = [
    { code: "00", description: "Approved", count: 1250 },
    { code: "05", description: "Do not honor", count: 45 },
    { code: "51", description: "Insufficient funds", count: 78 },
    { code: "91", description: "Issuer unavailable", count: 23 },
    { code: "96", description: "System error", count: 12 },
  ];
  const rcMult = 0.8 + (seed % 30) / 100;
  const mockResponseCodes = responseCodesBase.map((r) => ({
    ...r,
    count: Math.round(r.count * rcMult),
  }));

  const avgNe = 0;
  const avgFt = 0.2 + (seed % 15) / 100;

  return {
    successVolumes7d,
    failedTop5Codes: mockFailedTop5Codes,
    transactionsByChannel: mockTransactionsByChannel,
    failureByInstitution: mockFailureByInstitution,
    metrics: {
      totalTransactions: String(totalTransactions),
      volume: `₦${volumeM.toFixed(1)}M`,
      successRate: `${(successRate * 100).toFixed(1)}%`,
      successCount: Math.round(totalTransactions * successRate),
      pendingDisputes: String(pendingDisputes),
    },
    chartData7d,
    responseCodes: mockResponseCodes,
    averageTime: { ne: avgNe, ft: avgFt },
  };
}

// Institution detail: RC breakdown (e.g. Opay Ltd)
export const mockInstitutionRcBreakdown = {
  "Opay Ltd": [
    { code: "RC-61", count: 1720, fill: "#06b6d4" },
    { code: "RC-05", count: 380, fill: "#06b6d4" },
    { code: "RC-07", count: 340, fill: "#06b6d4" },
    { code: "RC-13", count: 320, fill: "#06b6d4" },
    { code: "RC-25", count: 310, fill: "#06b6d4" },
    { code: "RC-57", count: 180, fill: "#06b6d4" },
    { code: "RC-21", count: 95, fill: "#06b6d4" },
    { code: "RC-12", count: 72, fill: "#06b6d4" },
    { code: "RC-68", count: 38, fill: "#06b6d4" },
    { code: "RC-91", count: 22, fill: "#06b6d4" },
    { code: "RC-96", count: 18, fill: "#06b6d4" },
    { code: "RC-97", count: 5, fill: "#06b6d4" },
  ],
  "MoniePoint": [
    { code: "RC-61", count: 1100, fill: "#3b82f6" },
    { code: "RC-05", count: 420, fill: "#3b82f6" },
    { code: "RC-25", count: 280, fill: "#3b82f6" },
    { code: "RC-07", count: 220, fill: "#3b82f6" },
    { code: "RC-13", count: 160, fill: "#3b82f6" },
  ],
  "GTB": [
    { code: "RC-61", count: 620, fill: "#f97316" },
    { code: "RC-51", count: 380, fill: "#f97316" },
    { code: "RC-05", count: 280, fill: "#f97316" },
    { code: "RC-91", count: 140, fill: "#f97316" },
    { code: "RC-96", count: 100, fill: "#f97316" },
  ],
};

// Live Rates Monitoring: time-series inflow/outflow per institution
const LIVE_RATES_NUM_POINTS = 10;
const LIVE_RATES_INTERVAL_MINUTES = 10;

function formatTimeLabel(d) {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")}${ampm}`;
}

function getLiveRatesTimeLabels(endTime = new Date()) {
  const labels = [];
  for (let i = 0; i < LIVE_RATES_NUM_POINTS; i++) {
    const t = new Date(endTime.getTime() - (LIVE_RATES_NUM_POINTS - 1 - i) * LIVE_RATES_INTERVAL_MINUTES * 60 * 1000);
    labels.push(formatTimeLabel(t));
  }
  return labels;
}

function makeTimeSeries(timeLabels, inflowValues, outflowValues) {
  return timeLabels.map((time, i) => ({
    time,
    inflow: inflowValues[i] ?? 0,
    outflow: outflowValues[i] ?? 0,
  }));
}

const LIVE_RATES_INSTITUTIONS = [
  {
    name: "9Payment Service Bank (9Payment Service Bank)",
    shortName: "9Payment Service Bank",
    inflowData: [12, 28, 52, 65, 72, 68, 58, 45, 35, 30],
    outflowData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    inflowSuccess: 0,
    inflowFailure: 100,
    outflowSuccess: 0,
    outflowFailure: 100,
  },
  {
    name: "Access Bank (Access)",
    shortName: "Access Bank",
    inflowData: [75, 76, 78, 77, 79, 80, 79, 78, 77, 78],
    outflowData: [72, 73, 74, 75, 74, 76, 75, 74, 75, 76],
    inflowSuccess: 99,
    inflowFailure: 1,
    outflowSuccess: 98,
    outflowFailure: 2,
  },
  {
    name: "Accion Microfinance Bank (Accion Microfinance Bank)",
    shortName: "Accion Microfinance Bank",
    inflowData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    outflowData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    inflowSuccess: 0,
    inflowFailure: 100,
    outflowSuccess: 0,
    outflowFailure: 100,
    yAxisDomain: [-1, 1],
  },
  {
    name: "BOLD MFB (BOLD)",
    shortName: "BOLD MFB",
    inflowData: [78, 77, 79, 80, 79, 78, 80, 79, 78, 79],
    outflowData: [80, 79, 78, 79, 80, 79, 78, 79, 80, 79],
    inflowSuccess: 100,
    inflowFailure: 0,
    outflowSuccess: 100,
    outflowFailure: 0,
  },
  {
    name: "Citi Bank (Citi Bank)",
    shortName: "Citi Bank",
    inflowData: [80, 79, 80, 78, 79, 80, 79, 80, 79, 80],
    outflowData: [76, 77, 76, 77, 76, 77, 76, 77, 76, 77],
    inflowSuccess: 100,
    inflowFailure: 0,
    outflowSuccess: 99,
    outflowFailure: 1,
  },
  {
    name: "CoralPay Technology Nigeria Limited (CoralPay)",
    shortName: "CoralPay",
    inflowData: [79, 78, 80, 79, 78, 79, 80, 79, 78, 79],
    outflowData: [80, 79, 78, 79, 80, 79, 78, 79, 80, 79],
    inflowSuccess: 100,
    inflowFailure: 0,
    outflowSuccess: 100,
    outflowFailure: 0,
  },
  {
    name: "DAVENPORT MICROFINANCE BANK (DAVENPORT)",
    shortName: "DAVENPORT MFB",
    inflowData: [77, 78, 79, 78, 79, 80, 79, 78, 79, 80],
    outflowData: [78, 79, 78, 79, 80, 79, 78, 79, 80, 79],
    inflowSuccess: 100,
    inflowFailure: 0,
    outflowSuccess: 100,
    outflowFailure: 0,
  },
  {
    name: "Ecobank Bank (Ecobank Bank)",
    shortName: "Ecobank",
    inflowData: [76, 77, 78, 79, 78, 77, 79, 80, 79, 78],
    outflowData: [75, 76, 77, 76, 77, 78, 77, 76, 77, 78],
    inflowSuccess: 98,
    inflowFailure: 2,
    outflowSuccess: 97,
    outflowFailure: 3,
  },
  {
    name: "Fidelity Bank (Fidelity)",
    shortName: "Fidelity Bank",
    inflowData: [72, 74, 76, 75, 77, 78, 76, 77, 78, 79],
    outflowData: [70, 72, 73, 74, 75, 74, 76, 75, 76, 77],
    inflowSuccess: 97,
    inflowFailure: 3,
    outflowSuccess: 96,
    outflowFailure: 4,
  },
  {
    name: "GTBank (GTBank)",
    shortName: "GTBank",
    inflowData: [78, 79, 80, 79, 78, 79, 80, 79, 80, 79],
    outflowData: [77, 78, 77, 78, 79, 78, 77, 78, 79, 80],
    inflowSuccess: 99,
    inflowFailure: 1,
    outflowSuccess: 99,
    outflowFailure: 1,
  },
];

export function getLiveRatesMonitoring(endTime = new Date()) {
  const timeLabels = getLiveRatesTimeLabels(endTime);
  return LIVE_RATES_INSTITUTIONS.map((inst) => ({
    name: inst.name,
    shortName: inst.shortName,
    timeSeries: makeTimeSeries(timeLabels, inst.inflowData, inst.outflowData),
    inflowSuccess: inst.inflowSuccess,
    inflowFailure: inst.inflowFailure,
    outflowSuccess: inst.outflowSuccess,
    outflowFailure: inst.outflowFailure,
    yAxisDomain: inst.yAxisDomain,
  }));
}

export const mockLiveRatesMonitoring = getLiveRatesMonitoring(new Date());
