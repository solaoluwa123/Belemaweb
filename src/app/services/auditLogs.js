import { API_ENDPOINTS, apiClient } from "./api";

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGIN_2FA",
  "LOGIN_2FA_FAILED",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "MUTATION",
];

export const AUDIT_OUTCOMES = ["SUCCESS", "FAILURE"];

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null && v !== "");
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["data", "records", "items", "results", "content"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

function parseMeta(payload) {
  const raw = payload?.meta;
  if (!raw) return { totalRecords: 0, page: 1, limit: 50 };
  if (typeof raw === "object") {
    return {
      totalRecords: Number(raw.totalRecords ?? raw.total ?? 0) || 0,
      page: Number(raw.page ?? 1) || 1,
      limit: Number(raw.limit ?? 50) || 50,
    };
  }
  try {
    const parsed = JSON.parse(String(raw));
    return {
      totalRecords: Number(parsed.totalRecords ?? parsed.total ?? 0) || 0,
      page: Number(parsed.page ?? 1) || 1,
      limit: Number(parsed.limit ?? 50) || 50,
    };
  } catch {
    return { totalRecords: 0, page: 1, limit: 50 };
  }
}

/** Normalize one API audit-log row for the UI. */
export function mapAuditLogRow(row, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  return {
    id: firstDefined(source.id, `audit-${index}`),
    eventTime: String(
      firstDefined(source.event_time, source.eventTime, source.createdAt, "") || "",
    ).trim(),
    actorUsername: String(
      firstDefined(source.actor_username, source.actorUsername, "") || "",
    ).trim(),
    actorEmail: String(firstDefined(source.actor_email, source.actorEmail, "") || "").trim(),
    actorRole: firstDefined(source.actor_role, source.actorRole, null),
    action: String(firstDefined(source.action, "") || "").trim(),
    resource: String(firstDefined(source.resource, "") || "").trim(),
    httpMethod: String(firstDefined(source.http_method, source.httpMethod, "") || "").trim(),
    requestPath: String(firstDefined(source.request_path, source.requestPath, "") || "").trim(),
    ipAddress: String(firstDefined(source.ip_address, source.ipAddress, "") || "").trim(),
    userAgent: String(firstDefined(source.user_agent, source.userAgent, "") || "").trim(),
    outcome: String(firstDefined(source.outcome, "") || "").trim().toUpperCase(),
    httpStatus: firstDefined(source.http_status, source.httpStatus, null),
    details: String(firstDefined(source.details, "") || "").trim(),
    _raw: source,
  };
}

function buildListParams({
  page = 1,
  limit = 50,
  startDate,
  endDate,
  email,
  username,
  action,
  outcome,
} = {}) {
  const params = {
    page: String(page < 1 ? 1 : page),
    limit: String(Math.min(Math.max(limit || 50, 1), 200)),
  };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (email) params.email = email;
  if (username) params.username = username;
  if (action) params.action = action;
  if (outcome) params.outcome = outcome;
  return params;
}

/**
 * `GET /audit-logs` — admin-only audit trail.
 * @returns {{ rows: object[], meta: { totalRecords, page, limit } }}
 */
export async function fetchAuditLogs(filters = {}) {
  const payload = await apiClient.get(API_ENDPOINTS.admin.auditLogs, buildListParams(filters));
  const rows = unwrapArray(payload).map((row, index) => mapAuditLogRow(row, index));
  return { rows, meta: parseMeta(payload) };
}

/** `GET /audit-logs/{id}` */
export async function fetchAuditLogById(id) {
  const payload = await apiClient.get(API_ENDPOINTS.admin.auditLogById(id));
  const rows = unwrapArray(payload).map((row, index) => mapAuditLogRow(row, index));
  return rows[0] || null;
}
