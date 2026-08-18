import { apiClient, API_ENDPOINTS } from "./api";

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of ["data", "records", "items", "results", "institutions"]) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

export async function fetchInstitutionActions() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.institutionActions);
  const institutions = payload?.institutions ?? payload;
  return {
    institutionTypes: Array.isArray(payload?.institutionTypes) ? payload.institutionTypes : [],
    institutions: Array.isArray(institutions) ? institutions : [],
  };
}

/**
 * `GET /financial-institutions` — full registered institutions list (`tbl_nodes` joined with
 * `tbl_financial_institutions`, `tbl_charges`, and `tbl_institution_types`).
 *
 * Returns the same `{ institutions, institutionTypes }` shape as `fetchInstitutionActions`
 * so the admin page can swap data sources without changing its destructuring. The rows are
 * the raw backend objects (with backend column names — `name`, `shortName`,
 * `business_address`, `port_number`, `businessTypeName`, `charge_amount`, `vat`, `status`,
 * `date_created`, …) so callers should normalise via `institutionToTableRow`.
 */
export async function fetchInstitutionsFull() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.institutions);
  const institutions = unwrapList(payload);
  return {
    institutionTypes: Array.isArray(payload?.institutionTypes) ? payload.institutionTypes : [],
    institutions,
  };
}

/**
 * `GET /financial-institutions` — full institutions list (`tbl_nodes`).
 * Returns `[{ id, code, name, status, raw }]`. The list is the canonical source for institution
 * codes used as FKs by `tbl_wallets.financialInstitutionCode`, so other forms should hydrate
 * their dropdowns from this rather than hard-coding codes.
 *
 * @param {{ activeOnly?: boolean }} [options] - filter to status==="1" entries (default true).
 */
export async function fetchInstitutionsList({ activeOnly = true } = {}) {
  const payload = await apiClient.get(API_ENDPOINTS.admin.institutions);
  const rows = unwrapList(payload);
  const normalized = rows
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      const code = String(source.code ?? source.institutionCode ?? source.financialInstitutionCode ?? "").trim();
      const name = String(
        source.name ?? source.financialInstitutionName ?? source.shortName ?? source.businessName ?? code
      ).trim();
      return {
        id: source.id != null ? String(source.id) : code,
        code,
        name,
        status: String(source.status ?? "").trim(),
        raw: source,
      };
    })
    .filter((item) => item.code);
  return activeOnly ? normalized.filter((item) => item.status === "" || item.status === "1") : normalized;
}

/** `GET /financial-institutions/types` — canonical type list (may overlap with `fetchInstitutionActions`.institutionTypes). */
export async function fetchInstitutionTypeList() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.institutionTypes);
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of ["data", "types", "items", "records"]) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

/**
 * Normalise a `UserModel` contact row from
 * `GET /financial-institutions/contacts` (or `.../institution/{code}`).
 * Backend fields: firstname, surname, email_address, phone_number, date_created, institution.
 */
export function normalizeInstitutionContact(row, fallbackInstitutionCode = "") {
  const source = row && typeof row === "object" ? row : {};
  const firstname = String(source.firstname ?? source.firstName ?? "").trim();
  const surname = String(source.surname ?? source.lastName ?? "").trim();
  const composedName = [firstname, surname].filter(Boolean).join(" ").trim();
  const fullName = String(
    source.fullName ?? source.name ?? composedName
  ).trim();
  const email = String(
    source.email_address ?? source.emailAddress ?? source.email ?? ""
  ).trim();
  const mobile = String(
    source.phone_number ?? source.phoneNumber ?? source.mobile ?? source.phone ?? ""
  ).trim();
  const dateCreated = String(
    source.date_created ?? source.dateCreated ?? source.createdAt ?? ""
  ).trim();
  const institutionCode = String(
    source.institution ??
      source.financial_institution_code ??
      source.financialInstitutionCode ??
      fallbackInstitutionCode ??
      ""
  ).trim();
  return {
    id: source.id != null ? String(source.id) : email || fullName,
    fullName: fullName || email || "—",
    firstname,
    surname,
    email,
    mobile,
    dateCreated,
    institutionCode,
    institutionName: String(source.institutionName ?? source.institutionname ?? "").trim(),
    raw: source,
  };
}

export async function fetchAllContacts() {
  const payload = await apiClient.get(API_ENDPOINTS.admin.contacts);
  return unwrapList(payload).map((row) => normalizeInstitutionContact(row));
}

export async function fetchContactsForInstitution(institutionCode) {
  if (!institutionCode) return [];
  const payload = await apiClient.get(
    API_ENDPOINTS.admin.contactsByInstitution(institutionCode)
  );
  return unwrapList(payload).map((row) =>
    normalizeInstitutionContact(row, institutionCode)
  );
}

export function mapFiTypeToUi(institutionType) {
  const t = String(institutionType || "").toLowerCase();
  if (t.includes("fintech") || t === "other" || t.includes("others")) return "Others";
  return "Bank";
}

export function mapUiTypeToFi(uiType) {
  return uiType === "Others" ? "Fintech" : "Commercial Bank";
}

/**
 * Map a backend `status` (or `tbl_nodes.is_active`) value onto a UI label.
 *
 *   `tbl_nodes.is_active`: 1 → Active, -1 → Inactive, 0 → Suspended (pending)
 *   workflow status:       "Approved" → Active, "Suspended" → Suspended,
 *                          "Inactive"/"Rejected" → Inactive, "Pending" → Suspended
 */
export function mapApiStatusToUi(status) {
  const s = String(status ?? "").trim();
  if (s === "" || s === "null" || s === "undefined") return "Active";
  if (s === "1" || s === "Approved") return "Active";
  if (s === "-1" || s === "Inactive" || s === "Rejected") return "Inactive";
  if (s === "0" || s === "Suspended" || s === "Pending") return "Suspended";
  return "Active";
}

export function mapUiStatusToApi(uiStatus) {
  const u = String(uiStatus || "Active");
  if (u === "Active") return "Approved";
  if (u === "Suspended") return "Suspended";
  if (u === "Inactive") return "Inactive";
  return "Approved";
}

/**
 * Normalise a row returned by `GET /financial-institutions` (or the older
 * `/financial-institutions/get/actions`) into the shape the admin table expects.
 *
 * Backend column names (from the SQL that joins `tbl_nodes` + `tbl_financial_institutions`
 * + `tbl_charges` + `tbl_institution_types`):
 *   `id`, `name`, `code`, `port_number`, `publickeylocation`, `status` (alias for
 *   `is_active`: 1 / -1 / 0), `date_created`, `cbn_bank_account`, `isProcessTSQ`,
 *   `shortName`, `color`, `businessType` (id), `business_address`, `date_updated`,
 *   `businessTypeName`, `charge_amount`, `vat`.
 *
 * Earlier camelCase aliases (`financialInstitutionName`, `address`, `portNumber`,
 * `institutionType`, `chargesVat`, `dateCreated`) are still accepted so legacy callers
 * keep working.
 */
export function institutionToTableRow(fi, contactCount) {
  const code = String(fi.code || fi.institutionCode || "");
  const name = fi.name || fi.financialInstitutionName || fi.businessName || "";
  const shortName = fi.shortName || fi.short_name || name;
  const businessAddress =
    fi.business_address || fi.businessAddress || fi.address || "-";
  const portNumberRaw = fi.port_number ?? fi.portNumber;
  const portNumber =
    portNumberRaw === null || portNumberRaw === undefined || portNumberRaw === ""
      ? "-"
      : String(portNumberRaw);
  const typeName =
    fi.businessTypeName || fi.institutionType || fi.businessType || "";
  const chargeAmount = fi.charge_amount ?? fi.chargeAmount;
  const vat = fi.vat ?? fi.chargesVat;
  const chargesVat =
    chargeAmount !== undefined && chargeAmount !== null && chargeAmount !== ""
      ? `${chargeAmount}${vat !== undefined && vat !== "" ? ` / ${vat}%` : ""}`
      : fi.chargesVat || "-";
  const dateCreated =
    fi.date_created || fi.dateCreated
      ? String(fi.date_created || fi.dateCreated).slice(0, 10)
      : "-";
  return {
    id: code,
    businessName: name,
    shortName,
    businessAddress,
    code,
    portNumber,
    type: mapFiTypeToUi(typeName),
    contacts: String(contactCount ?? 0),
    chargesVat,
    dateCreated,
    status: mapApiStatusToUi(fi.status),
    _raw: fi,
  };
}
