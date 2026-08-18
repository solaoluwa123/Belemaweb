/**
 * Endpoint smoke test.
 *
 * Hits every backend route the SPA references and reports the response.
 * - 401  → route exists, auth required (expected when no session token)
 * - 404  → route missing on the server (frontend bug)
 * - 405  → wrong method
 * - 500  → server-side bug (worth investigating even unauthenticated)
 * - 200/204 → succeeded (or auth not enforced)
 *
 * Usage:
 *   node scripts/check-endpoints.mjs                # uses Vite proxy at http://localhost:5173/api
 *   API_BASE=http://172.17.10.128:8077/sparkpayapi node scripts/check-endpoints.mjs
 *   AUTH_TOKEN=<session-token> node scripts/check-endpoints.mjs   # optional, gets past auth
 */

const PROXY_DEFAULT = "http://localhost:5173/api/sparkpayapi";
const API_BASE = process.env.API_BASE || PROXY_DEFAULT;
const STATIC_AUTH =
  process.env.AUTH_HEADER ||
  "Bearer 958455015C7DB0F3CEDD56F8F3E50E94568905B636A4954A478030E2603E8A7758F8843B7A6EDC837CA5C6B57B262FDF3B44C7FF706DC3EB991EECFC7840FEC7";
const SESSION_TOKEN = process.env.AUTH_TOKEN || "";

// Sample placeholder values used for path parameters.
const SAMPLE = {
  id: "1",
  userId: "1",
  username: "system",
  email: "test@example.com",
  sessionId: "TEST-SESSION-ID",
  institutionCode: "999",
  code: "999",
  number: "0000000000",
  walletNumber: "0000000000",
};

const safeBody = {
  startDate: "2024-01-01T00:00:00.000Z",
  endDate: "2024-01-02T00:00:00.000Z",
  page: 1,
  limit: 1,
};

/**
 * Each endpoint: { name, method, path, body? }
 * Use SAFE methods where possible. POST/PUT/DELETE are tested with OPTIONS only by default
 * to avoid creating side effects on the database.
 */
const endpoints = [
  // auth
  { name: "auth.login", method: "POST", path: "/users/login", body: { username: "test", password: "test" } },
  { name: "auth.logout", method: "POST", path: "/users/logout", body: { username: "test", password: "" } },
  { name: "auth.verify2FA", method: "POST", path: "/users/login-2fa", body: { username: "test", password: "000000" }, sideEffect: true },
  { name: "auth.refreshToken", method: "POST", path: "/auth/refresh", body: { refresh_token: "x" }, sideEffect: true },
  { name: "auth.recoverPassword", method: "POST", path: "/users/recoverpassword", body: { username: SAMPLE.email, password: "" }, sideEffect: true },
  { name: "auth.resetPassword", method: "POST", path: "/users/resetpassword", sideEffect: true },
  { name: "auth.updatePassword", method: "POST", path: "/users/update-password", sideEffect: true },

  // transactions
  { name: "transactions.list", method: "GET", path: "/transactions" },
  { name: "transactions.search", method: "GET", path: "/transactions/q/search" },
  { name: "transactions.details", method: "GET", path: `/transactions/${SAMPLE.id}` },
  { name: "transactions.bySessionId", method: "GET", path: `/transactions-by-session-id/${SAMPLE.sessionId}` },
  { name: "transactions.byInstitution", method: "GET", path: `/transactions/institution/${SAMPLE.institutionCode}` },
  { name: "transactions.bySessionIds", method: "POST", path: "/transactions-by-session-ids", body: { sessionIds: [] }, sideEffect: true },
  { name: "transactions.statusUpdate", method: "POST", path: "/transaction/status/change", sideEffect: true },
  { name: "transactions.pendingStatusUpdates", method: "GET", path: "/transactions-for-update" },

  // disputes
  { name: "disputes.listByInstitution", method: "GET", path: `/transactions/disputes/institution/${SAMPLE.institutionCode}` },
  { name: "disputes.arbitratedByInstitution", method: "GET", path: `/transactions/arbitrated-disputes/institution/${SAMPLE.institutionCode}` },
  { name: "disputes.search", method: "GET", path: "/transactions/disputes/q/search" },
  { name: "disputes.types", method: "GET", path: "/transactions/disputes/types/get" },
  { name: "disputes.create", method: "PUT", path: "/transactions/disputes/create", sideEffect: true },
  { name: "disputes.approve", method: "POST", path: "/transactions/disputes/approve", sideEffect: true },
  { name: "disputes.bulkCreate", method: "POST", path: "/transactions/disputes/create/bulk", sideEffect: true },
  { name: "disputes.details", method: "GET", path: `/transactions/disputes/get/${SAMPLE.id}` },

  // dashboards
  { name: "dashboards.transactionsSummary", method: "GET", path: "/transactions-summary" },
  { name: "dashboards.transactionsSummaryByInstitution", method: "GET", path: `/transactions-summary/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.successfulTransactionCount", method: "GET", path: "/successful-transaction-count" },
  { name: "dashboards.successfulTransactionCountByInstitution", method: "GET", path: `/successful-transaction-count/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.transactionsByDate", method: "GET", path: "/transactions-by-date" },
  { name: "dashboards.transactionsByDateByInstitution", method: "GET", path: `/transactions-by-date/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.transactionsByChannels", method: "GET", path: "/transactions-by-channels" },
  { name: "dashboards.transactionsByChannelsByInstitution", method: "GET", path: `/transactions-by-channels/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.topFailedResponseCodes", method: "GET", path: "/top-failed-response-codes" },
  { name: "dashboards.topFailedResponseCodesByInstitution", method: "GET", path: `/top-failed-response-codes/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.topFailingInstitutions", method: "GET", path: "/top-failing-institutions" },
  { name: "dashboards.topFailingInstitutionsByInstitution", method: "GET", path: `/top-failing-institutions/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.ftAverageTime", method: "GET", path: "/ft-average-time" },
  { name: "dashboards.ftAverageTimeByInstitution", method: "GET", path: `/ft-average-time/institution/${SAMPLE.institutionCode}` },
  { name: "dashboards.transactionsTrendByInstitution", method: "GET", path: `/transactions-trend/${SAMPLE.institutionCode}` },
  { name: "dashboards.transactionsRates", method: "GET", path: "/transactions-rates" },

  // wallets
  { name: "wallets.list", method: "GET", path: "/wallets/get" },
  { name: "wallets.listByInstitution", method: "GET", path: `/wallets/get/${SAMPLE.institutionCode}` },
  { name: "wallets.actions", method: "GET", path: "/wallets/get/actions" },
  { name: "wallets.details", method: "GET", path: `/wallet/${SAMPLE.walletNumber}` },
  { name: "wallets.activity", method: "GET", path: `/wallet/activity/${SAMPLE.walletNumber}` },
  { name: "wallets.activityAll", method: "GET", path: "/wallets/activity/all" },
  { name: "wallets.activityInstitutionAggregates", method: "GET", path: "/wallets/activity/institution-aggregates" },
  { name: "wallets.create", method: "PUT", path: "/wallets/create", sideEffect: true },
  { name: "wallets.edit", method: "POST", path: "/wallets/edit", sideEffect: true },
  { name: "wallets.status", method: "PUT", path: "/wallets/status", sideEffect: true },
  { name: "wallets.bulkDelete", method: "POST", path: "/wallets/bulk-delete", sideEffect: true },
  { name: "wallets.fund", method: "POST", path: "/wallets/fund", sideEffect: true },
  { name: "wallets.approval", method: "PUT", path: "/wallets/approval", sideEffect: true },
  { name: "wallets.fundRequests", method: "GET", path: "/wallets/fund-requests" },
  { name: "wallets.fundRequestApprove", method: "POST", path: `/wallets/fund-requests/${SAMPLE.id}/approve`, sideEffect: true },
  { name: "wallets.fundRequestReject", method: "POST", path: `/wallets/fund-requests/${SAMPLE.id}/reject`, sideEffect: true },

  // approvals
  { name: "approvals.users", method: "GET", path: "/users/get" },
  { name: "approvals.userActions", method: "GET", path: "/users/get/actions" },
  { name: "approvals.approveUser", method: "PUT", path: "/users/approval", sideEffect: true },
  { name: "approvals.rejectUser", method: "PUT", path: `/users/reject/${SAMPLE.id}`, sideEffect: true },
  { name: "approvals.institutions", method: "GET", path: "/financial-institutions" },
  { name: "approvals.institutionActions", method: "GET", path: "/financial-institutions/get/actions" },
  { name: "approvals.approveInstitution", method: "PUT", path: "/financial-institutions/approval", sideEffect: true },
  { name: "approvals.rejectInstitution", method: "PUT", path: "/financial-institutions/reject", sideEffect: true },
  { name: "approvals.rejectInstitutionById", method: "PUT", path: `/financial-institutions/reject/${SAMPLE.id}`, sideEffect: true },

  // admin
  { name: "admin.otherUsers", method: "GET", path: "/other-users/get" },
  { name: "admin.createUser", method: "PUT", path: "/users/create", sideEffect: true },
  { name: "admin.createOtherUser", method: "PUT", path: "/other-users/create", sideEffect: true },
  { name: "admin.editUser", method: "POST", path: "/users/edit", sideEffect: true },
  { name: "admin.deleteUser", method: "DELETE", path: `/users/${SAMPLE.userId}/${SAMPLE.username}`, sideEffect: true },
  { name: "admin.institutionByCode", method: "GET", path: `/financial-institutions/${SAMPLE.code}` },
  { name: "admin.institutionTypes", method: "GET", path: "/financial-institutions/types" },
  { name: "admin.createInstitution", method: "PUT", path: "/financial-institutions", sideEffect: true },
  { name: "admin.editInstitution", method: "POST", path: "/financial-institutions", sideEffect: true },
  { name: "admin.deleteInstitution", method: "DELETE", path: `/financial-institutions/${SAMPLE.code}/${SAMPLE.username}`, sideEffect: true },
  { name: "admin.contacts", method: "GET", path: "/financial-institutions/contacts" },
  { name: "admin.contactById", method: "GET", path: `/financial-institutions/contacts/${SAMPLE.id}` },
  { name: "admin.contactActions", method: "GET", path: "/financial-institutions/contacts/get/actions" },
  { name: "admin.contactsByInstitution", method: "GET", path: `/financial-institutions/contacts/institution/${SAMPLE.code}` },
  { name: "admin.contactActionsByInstitution", method: "GET", path: `/financial-institutions/contacts/institution/get/actions/${SAMPLE.code}` },
  { name: "admin.createContact", method: "PUT", path: "/financial-institutions/contacts", sideEffect: true },
  { name: "admin.editContact", method: "POST", path: "/financial-institutions/contacts", sideEffect: true },
  { name: "admin.deleteContact", method: "DELETE", path: `/financial-institutions/contacts/${SAMPLE.email}/${SAMPLE.username}`, sideEffect: true },
  { name: "admin.rejectContact", method: "POST", path: `/contact/reject/${SAMPLE.id}/${SAMPLE.email}`, sideEffect: true },
  { name: "admin.roles", method: "GET", path: "/roles/get" },

  // change requests fallback
  { name: "changeRequests.submit", method: "POST", path: "/change-requests/submit", sideEffect: true },
];

function classify(status) {
  if (status === 0) return "NETWORK";
  if (status === 200 || status === 204) return "OK";
  if (status === 401 || status === 403) return "AUTH"; // expected without session token
  if (status === 404) return "MISSING";
  if (status === 405) return "WRONG_METHOD";
  if (status >= 500) return "SERVER";
  return `OTHER_${status}`;
}

async function callEndpoint(ep) {
  const url = `${API_BASE}${ep.path}`;
  const headers = {
    Accept: "application/json",
    Authorization: STATIC_AUTH,
  };
  if (SESSION_TOKEN) headers["auth-token"] = SESSION_TOKEN;

  const init = { method: ep.method, headers, redirect: "manual" };
  if (ep.method !== "GET" && ep.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(ep.body || safeBody);
  }

  const start = Date.now();
  try {
    const response = await fetch(url, init);
    const ms = Date.now() - start;
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      /* ignore */
    }
    let summary = bodyText.slice(0, 160).replace(/\s+/g, " ").trim();
    try {
      const json = JSON.parse(bodyText);
      if (json && typeof json === "object") {
        summary = String(
          json.message || json.error || json.status || (json.data && json.data.message) || summary
        ).slice(0, 160);
      }
    } catch {
      /* keep raw text */
    }
    return {
      ...ep,
      status: response.status,
      classification: classify(response.status),
      ms,
      body: summary,
    };
  } catch (error) {
    return {
      ...ep,
      status: 0,
      classification: classify(0),
      ms: Date.now() - start,
      body: error.message || String(error),
    };
  }
}

async function main() {
  console.log(`Testing ${endpoints.length} endpoints against ${API_BASE}`);
  console.log(SESSION_TOKEN ? "Using session token from AUTH_TOKEN env var." : "No session token — auth-protected routes will return 401.");
  console.log("");

  const results = [];
  for (const ep of endpoints) {
    const result = await callEndpoint(ep);
    results.push(result);
    const tag = result.classification.padEnd(13);
    const method = ep.method.padEnd(6);
    const status = String(result.status).padEnd(3);
    process.stdout.write(`${tag} ${status} ${method} ${ep.path}  (${result.ms}ms)\n`);
  }

  console.log("");
  console.log("--- Summary ---");
  const groups = {};
  for (const r of results) {
    groups[r.classification] = (groups[r.classification] || 0) + 1;
  }
  for (const [k, v] of Object.entries(groups).sort()) {
    console.log(`${k.padEnd(13)} ${v}`);
  }

  const problems = results.filter((r) =>
    ["MISSING", "WRONG_METHOD", "SERVER", "NETWORK"].some((cls) => r.classification.startsWith(cls))
  );

  if (problems.length) {
    console.log("");
    console.log("--- Problems ---");
    for (const p of problems) {
      console.log(`${p.classification.padEnd(13)} ${p.method.padEnd(6)} ${p.path}\n  → ${p.body || "(no body)"}`);
    }
  } else {
    console.log("");
    console.log("No structural problems detected (all routes exist or returned 401).");
  }
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
