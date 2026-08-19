import { APIError, API_ENDPOINTS, apiClient } from "./api";
import { getWalletTypeNameToIdMapFromEnv } from "../config/runtimeConfig";
import {
  parseBackendDate as parseBackendDateShared,
  getBackendDateTime,
} from "../utils/formatters";

const WALLET_TYPE_ID_BY_NAME = {
  Merchant: 1,
  PSSP: 2,
  PTSP: 3,
  "Super Agent": 4,
  Switch: 5,
};

/** Last wallet list returned by `fetchWallets` — used to infer real `wallettype` ids from API rows. */
let walletRowsCacheForTypeInference = [];

function inferWalletTypeIdFromCachedRows(accountType) {
  const name = String(accountType).trim().toLowerCase();
  for (const row of walletRowsCacheForTypeInference) {
    const raw = row?.raw;
    if (!raw || typeof raw !== "object") continue;
    const wtn = firstDefined(raw.walletTypeName, raw.wallettypename, raw.wallet_type_name);
    if (wtn == null || String(wtn).trim().toLowerCase() !== name) continue;
    const id = firstDefined(raw.wallettype, raw.walletType, raw.wallet_type);
    if (id === undefined || id === null || id === "") continue;
    const n = Number(id);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function resolveWalletTypeId(accountType) {
  const inferred = inferWalletTypeIdFromCachedRows(accountType);
  if (inferred !== undefined) return inferred;
  const envMap = getWalletTypeNameToIdMapFromEnv();
  const fromEnv = envMap[accountType];
  if (fromEnv !== undefined && fromEnv !== null && fromEnv !== "" && Number.isFinite(Number(fromEnv))) {
    return Number(fromEnv);
  }
  return WALLET_TYPE_ID_BY_NAME[accountType];
}

/**
 * Resolve a wallet type id with source provenance, so callers can warn the user when only a
 * hard-coded default is available (which is the most common cause of approval 500s when the
 * server's `tbl_wallet_types` ids differ from the client defaults).
 */
export function resolveWalletTypeIdWithSource(accountType) {
  const inferred = inferWalletTypeIdFromCachedRows(accountType);
  if (inferred !== undefined) return { id: inferred, source: "inferred" };
  const envMap = getWalletTypeNameToIdMapFromEnv();
  const fromEnv = envMap[accountType];
  if (fromEnv !== undefined && fromEnv !== null && fromEnv !== "" && Number.isFinite(Number(fromEnv))) {
    return { id: Number(fromEnv), source: "env" };
  }
  const fallback = WALLET_TYPE_ID_BY_NAME[accountType];
  if (fallback !== undefined) return { id: fallback, source: "default" };
  return { id: undefined, source: "unknown" };
}

/**
 * Pre-seed the wallet-type inference cache by fetching existing wallets. Call this from forms
 * that need to resolve `wallettype` before submit. Safe to call even when the user has no
 * wallets yet — the cache simply stays empty and callers fall through to env/default mapping.
 */
export async function ensureWalletTypeCache({ institutionCode } = {}) {
  if (walletRowsCacheForTypeInference.length) return walletRowsCacheForTypeInference;
  try {
    const rows = await fetchWallets({ institutionCode });
    return rows;
  } catch {
    return [];
  }
}

function safeJsonParse(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function unwrapPayload(value) {
  const parsed = safeJsonParse(value);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return parsed;

  for (const key of ["data", "result", "results", "response", "content", "records", "items"]) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      return unwrapPayload(parsed[key]);
    }
  }

  return parsed;
}

function asArray(value) {
  const unwrapped = unwrapPayload(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === "object") {
    const nestedArray = Object.values(unwrapped).find((entry) => Array.isArray(entry));
    if (nestedArray) return nestedArray;
    return [unwrapped];
  }
  return [];
}

function asObject(value) {
  const unwrapped = unwrapPayload(value);
  if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
    return unwrapped;
  }
  return {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

/**
 * Stringify safely — `String(undefined)` produces the literal string `"undefined"`, which then
 * leaks into UI cells (and is even truthy in `||` fallback chains, defeating row-level guards).
 * Always go through this helper instead of `String(firstDefined(...))`.
 */
function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Re-export the centralized `parseBackendDate` helper so existing imports
 * (`import { parseBackendDate } from "@/services/wallets"`) keep working while the
 * implementation lives in `utils/formatters.js`. See that helper for full handling
 * of MySQL DATETIME, zero-dates, ISO strings, epoch numbers, and `"undefined"` leaks.
 */
export const parseBackendDate = parseBackendDateShared;

/** Format a backend date string for display, falling back to the raw value when unparseable. */
function formatBackendDateForDisplay(value) {
  const parsed = parseBackendDate(value);
  if (!parsed) return safeString(value);
  return parsed.toISOString();
}

function normalizeWallet(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  // Backend (`WalletModel`) ships JSON keys with three different casings depending on the field —
  // `walletname` (lowercase), `financialInstitutionName` (camelCase), `financialInstitutionCode`,
  // `date_created`, etc. Include every spelling we've seen so a refactor on either side can't
  // silently break this view again.
  return {
    id: safeString(firstDefined(source.id, source.walletId, source.accountNumber), `WAL${index + 1}`),
    accountNumber: safeString(firstDefined(source.accountNumber, source.walletnumber, source.walletNumber)),
    accountName: safeString(firstDefined(source.accountName, source.walletname, source.walletName, source.name)),
    balance: toNumber(firstDefined(source.balance, source.currentBalance, source.amount)),
    currency: safeString(firstDefined(source.currency), "NGN"),
    status: safeString(firstDefined(source.status), "Active"),
    institutionId: safeString(
      firstDefined(
        source.institutionId,
        source.institution,
        source.financialInstitutionCode,
        source.financialinstitutioncode
      )
    ),
    institutionName: safeString(
      firstDefined(
        source.institutionName,
        source.financialInstitutionName,
        source.financialInstitutionname,
        source.institution?.name
      )
    ),
    // tbl_wallets.creationdate comes back as `YYYY-MM-DD HH:MM:SS` (MySQL DATETIME via
    // jdbc.getString). Normalize to ISO so downstream `new Date(...)` calls work in Safari.
    createdDate: formatBackendDateForDisplay(
      firstDefined(
        source.createdDate,
        source.dateCreated,
        source.createdAt,
        source.creationdate,
        source.date_created
      )
    ),
    raw: source,
  };
}

const DEFAULT_WALLET_ACTIVITY_RANGE_DAYS = 90;
const LIVE_WALLET_ACTIVITY_PAGE_LIMIT = 500;
const LIVE_COMBINED_ACTIVITY_MAX_WALLETS = 30;

/** Query shape required by OpenAPI for `GET /wallet/activity/{walletnumber}`. */
function buildWalletActivityQuery(options = {}) {
  const end =
    options.endDate instanceof Date
      ? options.endDate
      : options.endDate
        ? new Date(options.endDate)
        : new Date();
  const start =
    options.startDate instanceof Date
      ? options.startDate
      : options.startDate
        ? new Date(options.startDate)
        : new Date(end.getTime() - DEFAULT_WALLET_ACTIVITY_RANGE_DAYS * 86400000);

  return {
    startDate: Number.isNaN(start.getTime()) ? new Date(0).toISOString() : start.toISOString(),
    endDate: Number.isNaN(end.getTime()) ? new Date().toISOString() : end.toISOString(),
    page: options.page ?? 1,
    limit: options.limit ?? LIVE_WALLET_ACTIVITY_PAGE_LIMIT,
    isCurrent: options.isCurrent ?? true,
  };
}

/**
 * Wallet activity rows come from `ajiswitch_db.tbl_wallet_activities`
 * (`GET /wallet/activity/{walletnumber}`). The JAR's SELECT is `SELECT * …` against that
 * table, so JSON keys mirror MySQL column names verbatim:
 *
 *   id, walletnumber, amount, credit_or_debit, actor, activity_date_time
 *
 * We also accept transaction-style aliases (`dateTime`, `transactiondate`, `responsedatetime`,
 * camelCase variants) so this normalizer keeps working if the same component is reused for the
 * combined activity feed (`fetchAllWalletActivities`) which can mix shapes.
 */
function normalizeActivity(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const amount = toNumber(firstDefined(source.amount, source.transactionAmount, source.value));
  // `credit_or_debit` is the table's own flag (values e.g. "credit"/"debit").
  const creditOrDebitRaw = safeString(
    firstDefined(source.credit_or_debit, source.creditOrDebit, source.creditordebit)
  ).trim().toLowerCase();
  const type = safeString(
    firstDefined(source.type, source.transactionType, source.direction, creditOrDebitRaw || undefined),
    "Transaction"
  );
  // The backend `WalletsService.InitiateDebitCreditWallet` writes the staging
  // `actionType` ("cr" / "dr") straight into `tbl_wallet_activities.credit_or_debit`,
  // so the raw value is usually the two-letter code rather than the full word.
  // Recognise every common spelling explicitly here; otherwise a "cr" row falls
  // through the regex check (which only matches the substring "credit") and gets
  // tagged as a debit / outflow — which is the wrong direction.
  const isCredit =
    source.isCredit === true ||
    creditOrDebitRaw === "credit" ||
    creditOrDebitRaw === "cr" ||
    creditOrDebitRaw === "c" ||
    creditOrDebitRaw === "in" ||
    creditOrDebitRaw === "inflow" ||
    /credit|inflow/i.test(type);
  const flow = safeString(
    firstDefined(source.flow),
    isCredit ? "Inflow" : "Outflow"
  );
  const dateRaw = safeString(
    firstDefined(
      source.activity_date_time,
      source.activityDateTime,
      source.activitydatetime,
      source.dateTime,
      source.datetime,
      source.date,
      source.dateCreated,
      source.transactiondate,
      source.transactionDate,
      source.responsedatetime,
      source.responseDateTime,
      source.createdAt,
      source.creationdate,
      source.date_created
    )
  );
  let dateSort = dateRaw;
  const parsedDate = parseBackendDate(dateRaw);
  if (parsedDate) dateSort = parsedDate.toISOString();
  return {
    id: safeString(firstDefined(source.id, source.reference), `TX-${index + 1}`),
    date: dateRaw,
    dateSort,
    reference: safeString(
      firstDefined(source.reference, source.paymentReference, source.transactionId, source.sessionId)
    ),
    type,
    flow,
    amount,
    status: safeString(firstDefined(source.status, source.responseCodeDefinition), "Successful"),
    isCredit,
    details: safeString(
      firstDefined(
        source.details,
        source.description,
        source.narration,
        source.actor,
        creditOrDebitRaw ? `${creditOrDebitRaw} by ${safeString(source.actor)}`.trim() : undefined
      )
    ),
    counterparty: safeString(firstDefined(source.counterparty, source.beneficiary, source.actor)),
    walletId: safeString(firstDefined(source.walletId)),
    walletNumber: safeString(firstDefined(source.walletNumber, source.walletnumber)),
    walletName: safeString(firstDefined(source.walletName, source.walletname)),
    institutionId: safeString(
      firstDefined(source.institutionId, source.financialInstitutionCode, source.financialinstitutioncode)
    ),
    institutionName: safeString(
      firstDefined(source.institutionName, source.financialInstitutionName, source.financialInstitutionname)
    ),
    raw: source,
  };
}

function isGlobalInstitutionCode(code) {
  const value = String(code ?? "").trim();
  return !value || value === "-1";
}

/**
 * All wallets: `GET /wallets/get`.
 * Third Party Vendor (FI-scoped): `GET /wallets/get/{code}`.
 * If the global list returns 500, fall back to merging per-institution lists.
 */
export async function fetchWalletListPayload({
  institutionCode,
  requireInstitutionScope = false,
} = {}) {
  const code = String(institutionCode ?? "").trim();
  const scoped = requireInstitutionScope && !isGlobalInstitutionCode(code);
  if (requireInstitutionScope && !scoped) {
    throw new APIError("Institution code is required for this role.", 400, null);
  }
  if (scoped) {
    return apiClient.get(API_ENDPOINTS.wallets.listByInstitution(code));
  }
  try {
    return await apiClient.get(API_ENDPOINTS.wallets.list);
  } catch (err) {
    if (!(err instanceof APIError) || err.status !== 500) throw err;
    let dirPayload;
    try {
      dirPayload = await apiClient.get(API_ENDPOINTS.wallets.actions);
    } catch {
      throw err;
    }
    const source = asObject(dirPayload);
    const institutions = asArray(source.institutions || source.financialInstitutions || []);
    const codes = institutions
      .map((item) => {
        const row = item && typeof item === "object" ? item : {};
        return String(firstDefined(row.value, row.id, row.code, row.institutionId, "")).trim();
      })
      .filter((c) => c && c !== "-1");
    if (!codes.length) throw err;
    const chunks = await Promise.all(
      codes.map(async (code) => {
        try {
          return await apiClient.get(API_ENDPOINTS.wallets.listByInstitution(code));
        } catch {
          return null;
        }
      })
    );
    const merged = [];
    for (const chunk of chunks) {
      if (chunk == null) continue;
      merged.push(...asArray(chunk));
    }
    return merged;
  }
}

export async function fetchWallets({ institutionCode, requireInstitutionScope = false } = {}) {
  const payload = await fetchWalletListPayload({ institutionCode, requireInstitutionScope });
  const rows = asArray(payload).map(normalizeWallet);
  walletRowsCacheForTypeInference = rows;
  return rows;
}

export async function fetchWalletMeta() {
  const payload = await apiClient.get(API_ENDPOINTS.wallets.actions);
  const source = asObject(payload);
  const institutions = asArray(source.institutions || source.financialInstitutions || payload).map((item, index) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      value: String(firstDefined(row.value, row.id, row.code, row.institutionId, `INST${index + 1}`)),
      label: String(firstDefined(row.label, row.name, row.institutionName, row.description, `Institution ${index + 1}`)),
    };
  });

  return {
    institutions,
    raw: source,
  };
}

export async function fetchWalletDetails(walletNumber) {
  if (!walletNumber) {
    throw new APIError("A wallet number is required.", 400, null);
  }
  const payload = await apiClient.get(API_ENDPOINTS.wallets.details(walletNumber));
  return normalizeWallet(asObject(payload));
}

/**
 * `tbl_wallet_activities` only stores (walletnumber, amount, credit_or_debit, actor,
 * activity_date_time) — there is no institution column on the activity row. So a freshly
 * normalised activity has `institutionId`/`institutionName` blank, and the Institution
 * column on Wallet Activities renders empty.
 *
 * Enrich the row by joining against its parent wallet (looked up by walletnumber) and
 * filling in the institution fields. Pre-existing values on the activity row win, so this
 * is idempotent if the backend ever starts returning the join itself.
 */
function attachWalletInstitution(activity, wallet) {
  if (!activity) return activity;
  if (!wallet) return activity;
  const institutionId = activity.institutionId || wallet.institutionId || "";
  const institutionName = activity.institutionName || wallet.institutionName || "";
  if (institutionId === activity.institutionId && institutionName === activity.institutionName) {
    return activity;
  }
  return { ...activity, institutionId, institutionName };
}

function buildWalletLookupByNumber(wallets) {
  const map = new Map();
  for (const w of wallets || []) {
    const num = String(w?.accountNumber ?? w?.walletNumber ?? w?.walletnumber ?? "").trim();
    if (num) map.set(num, w);
  }
  return map;
}

function enrichActivitiesWithInstitution(activities, lookup) {
  if (!lookup || lookup.size === 0) return activities;
  return activities.map((row) => {
    const num = String(row?.walletNumber ?? "").trim();
    if (!num) return row;
    const wallet = lookup.get(num);
    return wallet ? attachWalletInstitution(row, wallet) : row;
  });
}

export async function fetchWalletActivity(walletNumber, activityOptions = {}) {
  if (!walletNumber) {
    throw new APIError("A wallet number is required.", 400, null);
  }
  const activityQuery = buildWalletActivityQuery(activityOptions);
  const [walletPayload, activityPayload] = await Promise.all([
    apiClient.get(API_ENDPOINTS.wallets.details(walletNumber)),
    apiClient.get(API_ENDPOINTS.wallets.activity(walletNumber), activityQuery),
  ]);

  const wallet = normalizeWallet(asObject(walletPayload));
  let activities = asArray(activityPayload)
    .map(normalizeActivity)
    .map((row) => attachWalletInstitution(row, wallet));
  activities.sort((a, b) => getBackendDateTime(b.dateSort || b.date) - getBackendDateTime(a.dateSort || a.date));
  const totals = activities.reduce(
    (acc, row) => {
      if (row.isCredit) acc.totalCredit += row.amount;
      else acc.totalDebit += row.amount;
      return acc;
    },
    { totalCredit: 0, totalDebit: 0 }
  );

  return {
    wallet,
    activities,
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    currentBalance: wallet.balance,
  };
}

/** Same path-shape 405 as `/wallets/activity/institution-aggregates` until backend adds GET handlers. */
const WALLET_ACTIVITY_ALL_SKIP_HTTP_KEY = "wallet_activity_all_skip_http_v1";

function shouldSkipWalletActivityAllHttp() {
  if (String(import.meta.env.VITE_SKIP_WALLET_ACTIVITY_ALL_HTTP ?? "").toLowerCase() === "true") {
    return true;
  }
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(WALLET_ACTIVITY_ALL_SKIP_HTTP_KEY) === "1";
}

function rememberWalletActivityAllHttpUnsupported() {
  try {
    sessionStorage.setItem(WALLET_ACTIVITY_ALL_SKIP_HTTP_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearWalletActivityAllHttpSkip() {
  try {
    sessionStorage.removeItem(WALLET_ACTIVITY_ALL_SKIP_HTTP_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchAllWalletActivitiesFromWalletsOnly({ institutionCode, requireInstitutionScope = false } = {}) {
  const wallets = await fetchWallets({ institutionCode, requireInstitutionScope });
  const slice = wallets.slice(0, LIVE_COMBINED_ACTIVITY_MAX_WALLETS);
  const query = buildWalletActivityQuery({ limit: 300 });
  const batches = await Promise.all(
    slice.map(async (w) => {
      const num = w.accountNumber;
      if (!num) return [];
      try {
        const payload = await apiClient.get(API_ENDPOINTS.wallets.activity(num), query);
        return asArray(payload)
          .map(normalizeActivity)
          .map((row) => attachWalletInstitution(row, w));
      } catch {
        return [];
      }
    })
  );
  const rows = batches.flat();
  rows.sort((a, b) => getBackendDateTime(b.dateSort || b.date) - getBackendDateTime(a.dateSort || a.date));
  return rows;
}

export async function fetchAllWalletActivities({ institutionCode, requireInstitutionScope = false } = {}) {
  const walletOpts = { institutionCode, requireInstitutionScope };
  if (shouldSkipWalletActivityAllHttp()) {
    return fetchAllWalletActivitiesFromWalletsOnly(walletOpts);
  }

  try {
    const [payload, walletsForLookup] = await Promise.all([
      apiClient.get(API_ENDPOINTS.wallets.activityAll),
      fetchWallets(walletOpts).catch(() => []),
    ]);
    clearWalletActivityAllHttpSkip();
    const lookup = buildWalletLookupByNumber(walletsForLookup);
    let rows = enrichActivitiesWithInstitution(
      asArray(payload).map(normalizeActivity),
      lookup,
    );
    if (requireInstitutionScope) {
      const allowedNums = new Set(lookup.keys());
      const mine = String(institutionCode || "").trim();
      rows = rows.filter((row) => {
        const num = String(row?.walletNumber || "").trim();
        if (allowedNums.size && num && allowedNums.has(num)) return true;
        const fi = String(row?.institutionId || "").trim();
        return Boolean(mine && fi && fi === mine);
      });
    }
    if (rows.length) {
      rows.sort(
        (a, b) => getBackendDateTime(b.dateSort || b.date) - getBackendDateTime(a.dateSort || a.date),
      );
      return rows;
    }
  } catch (error) {
    if (error instanceof APIError && (error.status === 404 || error.status === 405 || error.status === 501)) {
      rememberWalletActivityAllHttpUnsupported();
    }
    /* fall back: some deployments only expose per-wallet activity */
  }

  return fetchAllWalletActivitiesFromWalletsOnly(walletOpts);
}

/** After a 405 (path shadows DELETE /wallets/{x}/{y}), skip the broken URL for this tab until a successful GET clears it. */
const WALLET_INST_AGG_SKIP_HTTP_KEY = "wallet_institution_agg_skip_http_v1";

function shouldSkipWalletInstitutionAggregatesHttp() {
  if (String(import.meta.env.VITE_SKIP_WALLET_INSTITUTION_AGGREGATES_HTTP ?? "").toLowerCase() === "true") {
    return true;
  }
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(WALLET_INST_AGG_SKIP_HTTP_KEY) === "1";
}

function rememberWalletInstitutionAggregatesHttpUnsupported() {
  try {
    sessionStorage.setItem(WALLET_INST_AGG_SKIP_HTTP_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearWalletInstitutionAggregatesHttpSkip() {
  try {
    sessionStorage.removeItem(WALLET_INST_AGG_SKIP_HTTP_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * When `GET /wallets/activity/institution-aggregates` is missing (405) or empty, build the same shape from
 * combined wallet activity rows (per-wallet fallback inside `fetchAllWalletActivities`).
 */
async function buildInstitutionAggregatesFromActivitiesFallback() {
  const rows = await fetchAllWalletActivities();
  if (!rows.length) return [];

  const map = new Map();
  for (const r of rows) {
    const instId = String(r.institutionId || "").trim();
    const instKey = instId || "__unknown__";
    const instName = String(r.institutionName || "").trim();
    const raw = r.dateSort || r.date;
    const parsedDay = parseBackendDate(raw);
    const dayKey = parsedDay ? parsedDay.toISOString().slice(0, 10) : String(raw || "").slice(0, 10);
    if (!dayKey) continue;

    const k = `${instKey}|${dayKey}`;
    if (!map.has(k)) {
      map.set(k, {
        date: `${dayKey}T00:00:00`,
        institutionId: instKey === "__unknown__" ? "" : instKey,
        institutionName: instName,
        inflow: 0,
        outflow: 0,
        transactionCount: 0,
      });
    }
    const bucket = map.get(k);
    if (instName && !bucket.institutionName) bucket.institutionName = instName;
    if (r.isCredit) bucket.inflow += r.amount;
    else bucket.outflow += r.amount;
    bucket.transactionCount += 1;
  }

  return Array.from(map.values()).sort(
    (a, b) => getBackendDateTime(b.date) - getBackendDateTime(a.date),
  );
}

export async function fetchInstitutionWalletAggregates() {
  if (shouldSkipWalletInstitutionAggregatesHttp()) {
    try {
      return await buildInstitutionAggregatesFromActivitiesFallback();
    } catch {
      return [];
    }
  }

  try {
    const payload = await apiClient.get(API_ENDPOINTS.wallets.activityInstitutionAggregates);
    clearWalletInstitutionAggregatesHttpSkip();
    return asArray(payload);
  } catch (error) {
    if (error instanceof APIError && (error.status === 404 || error.status === 405 || error.status === 501)) {
      rememberWalletInstitutionAggregatesHttpUnsupported();
      try {
        return await buildInstitutionAggregatesFromActivitiesFallback();
      } catch {
        return [];
      }
    }
    throw error;
  }
}

export async function updateWalletName({ walletId, accountNumber, accountName }) {
  if (!accountName?.trim()) {
    throw new APIError("Wallet name is required.", 400, null);
  }
  // OpenAPI: POST /wallets/edit with WalletModel (`walletname`, `walletnumber`, …)
  return apiClient.post(API_ENDPOINTS.wallets.edit, {
    id: walletId != null ? Number(walletId) || walletId : undefined,
    walletnumber: accountNumber,
    walletname: accountName.trim(),
  });
}

export async function updateWalletStatus({ walletId, accountNumber, status }) {
  return apiClient.put(API_ENDPOINTS.wallets.status, {
    walletId,
    accountNumber,
    status,
  });
}

export async function deleteWalletsByIds(ids) {
  if (!ids?.length) {
    throw new APIError("Select at least one wallet to delete.", 400, null);
  }
  return apiClient.post(API_ENDPOINTS.wallets.bulkDelete, { ids });
}

/**
 * Funding requests are not a separate resource on the backend — they are credit/debit
 * entries in `tbl_wallets_operations` produced by `PUT /wallets/initiate-debit-credit`
 * and applied via `PUT /wallets/approval`. There is no `/wallets/fund-requests` route.
 * The helpers below adapt the maker–checker pages onto those real endpoints.
 */

const FUNDING_OP_ACTION_TYPES = new Set(["credit", "debit"]);
const HIDDEN_FUNDING_REQUEST_IDS_KEY = "hidden_funding_request_ids_v1";
const FUNDING_REQUEST_DECISIONS_KEY = "funding_request_decisions_v1";

function readHiddenFundingRequestIds() {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(HIDDEN_FUNDING_REQUEST_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function writeHiddenFundingRequestIds(set) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(HIDDEN_FUNDING_REQUEST_IDS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function readFundingRequestDecisions() {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(FUNDING_REQUEST_DECISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeFundingRequestDecisions(map) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(FUNDING_REQUEST_DECISIONS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Map a pending `tbl_wallets_operations` credit/debit row into the funding-request shape the
 * Fund Wallet pages expect (`{ id, status, walletNumber, accountName, amount, requestedBy, ... }`).
 */
function normalizeFundingOperation(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const actionType = safeString(firstDefined(source.actionType, source.actiontype)).trim().toLowerCase();
  const walletNumber = safeString(firstDefined(source.walletnumber, source.walletNumber));
  const walletName = safeString(firstDefined(source.walletname, source.walletName));
  const note = safeString(firstDefined(source.note, source.narration, source.description));
  return {
    id: safeString(firstDefined(source.id), `WOP${index + 1}`),
    actionType,
    status: "Pending",
    walletId: walletNumber,
    walletNumber,
    walletName,
    accountName: walletName,
    institutionId: safeString(firstDefined(source.financialInstitutionCode, source.financialinstitutioncode)),
    institutionName: safeString(firstDefined(source.financialInstitutionName, source.financialinstitutionname)),
    amount: toNumber(firstDefined(source.balance, source.amount)),
    narration: note,
    requestedBy: safeString(firstDefined(source.creator, source.username)),
    createdAt: safeString(firstDefined(source.date_created, source.dateCreated, source.createdAt, source.creationdate)),
    raw: { ...source, actionType },
  };
}

/**
 * Fetch the pending funding queue. Sourced from `/wallets/get/actions`, filtered to
 * `actionType in {credit, debit}`. Optionally includes/exclusive-shows rows that were
 * "rejected" locally (the backend has no reject endpoint; rejection is session-local).
 */
export async function fetchFundingRequests(options = {}) {
  const { includeDismissed = false, onlyDismissed = false } = options;
  const payload = await apiClient.get(API_ENDPOINTS.wallets.actions);
  const hiddenIds = readHiddenFundingRequestIds();
  const decisions = readFundingRequestDecisions();
  const rows = asArray(payload);
  return rows
    .filter((row) => {
      const t = String(row?.actionType ?? row?.actiontype ?? "").trim().toLowerCase();
      if (!FUNDING_OP_ACTION_TYPES.has(t)) return false;
      const id = String(row?.id ?? "");
      const isDismissed = id && hiddenIds.has(id);
      if (onlyDismissed) return isDismissed;
      if (isDismissed && !includeDismissed) return false;
      return true;
    })
    .map((row, index) => {
      const item = normalizeFundingOperation(row, index);
      const decision = item.id ? decisions[item.id] || null : null;
      return {
        ...item,
        status: decision?.kind === "rejected" ? "Rejected" : item.status,
        dismissed: item.id ? hiddenIds.has(item.id) : false,
        reviewedBy: decision?.decidedBy || "",
        reviewedAt: decision?.decidedAt || "",
        reviewNote: decision?.reason || "",
        decision,
      };
    });
}

/**
 * Minimum credit/debit amount enforced by `WalletsController.InitiateDebitCreditWallet`
 * (the controller returns `401 Unauthorized` when `amount < 100`). Keep this in sync with
 * the backend constant; pre-validate client-side so the user gets a useful message instead
 * of an opaque 401.
 */
const FUNDING_MINIMUM_AMOUNT = 100;

/**
 * Stage a wallet credit/debit on `tbl_wallets_operations` via `PUT /wallets/initiate-debit-credit`.
 *
 * Backend contract (`WalletsController.InitiateDebitCreditWallet`, verified against the JAR):
 *   The controller deserializes a `WalletModel` and unconditionally reads
 *     `walletnumber, actionType, amount, creator, balance`
 *   from it. `wallet.getBalance().doubleValue()` is called BEFORE any branching, so omitting
 *   `balance` triggers a `NullPointerException` → `500 Internal Server Error`. Every field in
 *   the payload below is therefore required.
 *
 * Controller validation gates (in order):
 *   1. `actionType ∈ {"cr","dr"}` else 400.
 *   2. `amount >= 100` AND (`actionType != "dr"` OR `walletbalance >= 100`) else 401.
 *   3. `actionType == "dr"` AND `amount > walletbalance` → 400.
 *
 * Service behaviour (`WalletsService.InitiateDebitCreditWallet`):
 *   - Role 1 (Admin) → applies the balance change immediately, returns 202.
 *   - Role 2 (Operator) → inserts a pending row in `tbl_wallets_operations` with
 *     `actionType = "credit" | "debit"` (the two-letter code is translated). The pending
 *     row is then approved by another user via `PUT /wallets/approval`.
 *   - Other roles → 401.
 */
export async function submitFundingRequest({
  wallet,
  walletNumber,
  walletId,
  amount,
  requestedBy,
  type = "credit",
  // `narration` is accepted for backwards compatibility but the service hard-codes the
  // operations-row note as "<amount> credit"/"<amount> debit", so it's not forwarded.
  // eslint-disable-next-line no-unused-vars
  narration,
} = {}) {
  const resolvedWalletNumber = String(
    walletNumber ??
      wallet?.accountNumber ??
      wallet?.walletNumber ??
      wallet?.walletnumber ??
      walletId ??
      "",
  ).trim();
  if (!resolvedWalletNumber) {
    throw new APIError("Select a wallet before submitting a funding request.", 400, null);
  }
  const numericAmount = toNumber(amount);
  if (!numericAmount || numericAmount <= 0) {
    throw new APIError("Funding amount must be greater than zero.", 400, null);
  }
  if (numericAmount < FUNDING_MINIMUM_AMOUNT) {
    throw new APIError(
      `Funding amount must be at least NGN ${FUNDING_MINIMUM_AMOUNT}.`,
      400,
      null
    );
  }
  const creator = String(requestedBy || "").trim();
  if (!creator) {
    throw new APIError("Requester identity is required.", 400, null);
  }

  const normalizedType = String(type || "credit").trim().toLowerCase();
  const isDebit = normalizedType === "debit" || normalizedType === "dr";
  const actionType = isDebit ? "dr" : "cr";

  // The controller pulls `balance` from the WalletModel and `getBalance().doubleValue()` is
  // unconditional, so we must always include it. For debits the controller additionally
  // requires `balance >= 100` and `amount <= balance` — surface those failures here so the
  // user sees something more meaningful than a raw 401/400.
  const walletBalance =
    wallet?.balance != null
      ? toNumber(wallet.balance)
      : wallet?.currentBalance != null
        ? toNumber(wallet.currentBalance)
        : null;
  if (walletBalance === null) {
    throw new APIError(
      "Wallet balance is not loaded for this wallet — refresh and try again.",
      400,
      null
    );
  }
  if (isDebit) {
    if (walletBalance < FUNDING_MINIMUM_AMOUNT) {
      throw new APIError(
        `Wallet balance must be at least NGN ${FUNDING_MINIMUM_AMOUNT} to debit.`,
        400,
        null
      );
    }
    if (numericAmount > walletBalance) {
      throw new APIError(
        "Debit amount cannot exceed the current wallet balance.",
        400,
        null
      );
    }
  }

  return apiClient.put(API_ENDPOINTS.wallets.initiateDebitCredit, {
    walletnumber: resolvedWalletNumber,
    actionType,
    amount: numericAmount,
    creator,
    balance: walletBalance,
  });
}

/**
 * Approve a pending funding row via `PUT /wallets/approve-funding`.
 *
 * This is a separate endpoint from `/wallets/approval` (which handles
 * create/edit/assign/delete decisions). The funding endpoint applies the actual
 * balance change in `tbl_wallets` once approved.
 *
 * The controller deserialises a full `WalletModel`, and — like every other approval
 * service in this backend — uses one of the body fields (`creator`) for the role
 * lookup `GetUserRole(creator, sessiontoken)`. Sending a bare `{id, actionType}`
 * is what produced the previous 401s; the helper now forwards the original row's
 * raw fields plus the approver's identity.
 *
 * @param {object} params
 * @param {object} [params.row]        Normalised funding row from `fetchFundingRequests`
 *                                     (preferred — gives the controller every column).
 * @param {string|number} [params.id]  Falls back to `row.id`.
 * @param {string} params.approvedBy   The logged-in approver — becomes `creator` in the body.
 * @param {string} [params.actionType] Falls back to `row.actionType`. Must normalize to
 *                                     `"credit"` or `"debit"`.
 * @param {string} [params.note]       Optional approver note; forwarded as `note`.
 */
export async function approveFundingRequest({ row, id, approvedBy, actionType, note } = {}) {
  const resolvedRow = row && typeof row === "object" ? row : null;
  const resolvedId = id ?? resolvedRow?.id;
  if (!resolvedId) throw new APIError("A funding request ID is required.", 400, null);
  const opType = String(actionType || resolvedRow?.actionType || "")
    .trim()
    .toLowerCase();
  if (!FUNDING_OP_ACTION_TYPES.has(opType)) {
    throw new APIError("Funding request actionType must be 'credit' or 'debit'.", 400, null);
  }
  const creator = String(approvedBy || "").trim();
  if (!creator) {
    throw new APIError("Approver identity is required.", 400, null);
  }

  const numericId = Number(resolvedId);
  const payloadId = Number.isFinite(numericId) ? numericId : resolvedId;
  const raw =
    resolvedRow && resolvedRow.raw && typeof resolvedRow.raw === "object"
      ? resolvedRow.raw
      : {};

  return apiClient.put(API_ENDPOINTS.wallets.approveFunding, {
    ...raw,
    id: payloadId,
    creator,
    actionType: opType,
    walletnumber: raw.walletnumber ?? resolvedRow?.walletNumber ?? "",
    walletname: raw.walletname ?? resolvedRow?.walletName ?? "",
    financialInstitutionCode:
      raw.financialInstitutionCode ?? raw.financialinstitutioncode ?? resolvedRow?.institutionId ?? "",
    financialInstitutionName:
      raw.financialInstitutionName ?? raw.financialinstitutionname ?? resolvedRow?.institutionName ?? "",
    amount: raw.amount ?? resolvedRow?.amount ?? 0,
    balance: raw.balance ?? resolvedRow?.amount ?? 0,
    note: note ?? raw.note ?? resolvedRow?.narration ?? "",
    status: "Approved",
  });
}

/**
 * Reject a pending funding row via `PUT /wallets/reject-funding`.
 *
 * Mirrors `approveFundingRequest` — the controller deserialises a full `WalletModel`
 * and uses `creator` for the maker-checker role gate. Sending a bare body produces
 * 401. We therefore forward the staged row's `raw` fields, overlay the reviewer as
 * `creator`, set `status: "Rejected"`, and forward the optional reviewer note as
 * `note`.
 *
 * The previous behaviour stored the rejection in `sessionStorage` because the
 * backend had no reject endpoint; the local mirror is kept in sync after the
 * remote call succeeds so anything else in the app (queue filters, dismissed
 * lists, "restore" undo, etc.) keeps working.
 *
 * @param {object} params
 * @param {object} [params.row]       Normalised funding row from `fetchFundingRequests`
 *                                    (preferred — gives the controller every column).
 * @param {string|number} [params.id] Falls back to `row.id`.
 * @param {string} params.reviewedBy  The logged-in reviewer — becomes `creator` in the body.
 * @param {string} [params.actionType] Falls back to `row.actionType`. Must normalise to
 *                                    `"credit"` or `"debit"`.
 * @param {string} [params.note]      Optional reviewer note; forwarded as `note`.
 */
export async function rejectFundingRequest({ row, id, reviewedBy, actionType, note = "" } = {}) {
  const resolvedRow = row && typeof row === "object" ? row : null;
  const resolvedId = id ?? resolvedRow?.id;
  if (!resolvedId) throw new APIError("A funding request ID is required.", 400, null);
  const opType = String(actionType || resolvedRow?.actionType || "")
    .trim()
    .toLowerCase();
  if (!FUNDING_OP_ACTION_TYPES.has(opType)) {
    throw new APIError("Funding request actionType must be 'credit' or 'debit'.", 400, null);
  }
  const creator = String(reviewedBy || "").trim();
  if (!creator) {
    throw new APIError("Reviewer identity is required.", 400, null);
  }

  const numericId = Number(resolvedId);
  const payloadId = Number.isFinite(numericId) ? numericId : resolvedId;
  const raw =
    resolvedRow && resolvedRow.raw && typeof resolvedRow.raw === "object"
      ? resolvedRow.raw
      : {};

  const response = await apiClient.put(API_ENDPOINTS.wallets.rejectFunding, {
    ...raw,
    id: payloadId,
    creator,
    actionType: opType,
    walletnumber: raw.walletnumber ?? resolvedRow?.walletNumber ?? "",
    walletname: raw.walletname ?? resolvedRow?.walletName ?? "",
    financialInstitutionCode:
      raw.financialInstitutionCode ?? raw.financialinstitutioncode ?? resolvedRow?.institutionId ?? "",
    financialInstitutionName:
      raw.financialInstitutionName ?? raw.financialinstitutionname ?? resolvedRow?.institutionName ?? "",
    amount: raw.amount ?? resolvedRow?.amount ?? 0,
    balance: raw.balance ?? resolvedRow?.amount ?? 0,
    note: String(note || raw.note || resolvedRow?.narration || ""),
    status: "Rejected",
  });

  // Keep the local mirror in sync so the queue filters / undo flow continue to
  // work even though the row will normally disappear from the backend list on
  // the next fetch.
  const set = readHiddenFundingRequestIds();
  set.add(String(resolvedId));
  writeHiddenFundingRequestIds(set);
  const decisions = readFundingRequestDecisions();
  decisions[String(resolvedId)] = {
    kind: "rejected",
    reason: String(note || "").trim(),
    decidedBy: creator,
    decidedAt: new Date().toISOString(),
  };
  writeFundingRequestDecisions(decisions);

  return response;
}

/** Restore a previously rejected funding row so it shows up in the queue again. */
export function restoreFundingRequest(id) {
  if (!id) return;
  const set = readHiddenFundingRequestIds();
  set.delete(String(id));
  writeHiddenFundingRequestIds(set);
  const decisions = readFundingRequestDecisions();
  if (decisions[String(id)]) {
    delete decisions[String(id)];
    writeFundingRequestDecisions(decisions);
  }
}

export async function createWallet({
  accountName,
  accountType,
  currency: _currency,
  institutionId,
  institutionName,
  creator,
}) {
  if (!accountName || !accountType || !institutionId || !institutionName) {
    throw new APIError(
      "Wallet name, type, institution code and name are required.",
      400,
      null
    );
  }

  const walletTypeId = resolveWalletTypeId(accountType);

  if (walletTypeId === undefined) {
    throw new APIError(
      `Unsupported wallet type for API: ${accountType}`,
      400,
      null
    );
  }

  // Backend `WalletsService.Create` only consults: creator, walletname,
  // financialInstitutionCode, wallettype. Everything else (walletnumber/date_created/
  // date_updated/balance/lien/baseAmount/status/financialInstitutionName/walletTypeName)
  // is overwritten or ignored — `creationdate` is set by MySQL `now()`, `walletnumber`
  // is server-generated, balance/lien default to 0.00. We still ship the human-readable
  // institution name + wallet-type name so server logs are easier to read, but they have
  // no effect on the SQL. See `WalletModel.java` for the JSON key casing the model expects.
  const payload = {
    creator: creator || "system",
    walletname: accountName,
    financialInstitutionCode: institutionId,
    financialInstitutionName: institutionName,
    walletTypeName: accountType,
    wallettype: walletTypeId,
  };

  return apiClient.put(API_ENDPOINTS.wallets.create, payload);
}
