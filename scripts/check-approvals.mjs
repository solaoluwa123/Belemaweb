/**
 * Focused smoke test for approval-role endpoints.
 *
 * Hits every endpoint used by the approver flows (Pending User Approvals, Wallet Approvals,
 * Institution Approvals, Change Requests Hub) with a real session token and reports the result.
 *
 * Usage:
 *   $env:AUTH_TOKEN="<token>"; node scripts/check-approvals.mjs
 *   AUTH_TOKEN=<token> node scripts/check-approvals.mjs
 *
 * Side-effecting routes (PUT /users/approval, PUT /wallets/approval, etc.) are called with
 * deliberately-bad sample data so the backend rejects the lookup before applying anything,
 * making the test idempotent.
 */

const PROXY_DEFAULT = "http://localhost:5173/api/sparkpayapi";
const API_BASE = process.env.API_BASE || PROXY_DEFAULT;
const STATIC_AUTH =
  process.env.AUTH_HEADER ||
  "Bearer 958455015C7DB0F3CEDD56F8F3E50E94568905B636A4954A478030E2603E8A7758F8843B7A6EDC837CA5C6B57B262FDF3B44C7FF706DC3EB991EECFC7840FEC7";
const SESSION_TOKEN = process.env.AUTH_TOKEN || "";

if (!SESSION_TOKEN) {
  console.error("ERROR: AUTH_TOKEN env var is required for this test.");
  console.error('Example: $env:AUTH_TOKEN="<token>"; node scripts/check-approvals.mjs');
  process.exit(1);
}

const SAFE_NONEXISTENT_ID = 99999999; // unlikely to match any real row
const NONEXISTENT_INSTITUTION_CODE = "ZZZ-NO-SUCH-CODE";

const endpoints = [
  // Pending user approvals (queue + apply + reject)
  { name: "approvals.userActions  (queue)", method: "GET", path: "/users/get/actions" },
  { name: "approvals.users        (catalog)", method: "GET", path: "/users/get" },
  {
    name: "approvals.approveUser  (apply)",
    method: "PUT",
    path: "/users/approval",
    body: { id: SAFE_NONEXISTENT_ID, actionType: "create", username: "smoke-test" },
  },
  {
    name: "approvals.rejectUser   (reject)",
    method: "PUT",
    path: `/users/reject/${SAFE_NONEXISTENT_ID}`,
    body: {},
  },

  // Wallet approvals (queue + apply)
  { name: "approvals.walletActions (queue)", method: "GET", path: "/wallets/get/actions" },
  { name: "approvals.wallets       (catalog)", method: "GET", path: "/wallets/get" },
  {
    name: "approvals.approveWallet (apply)",
    method: "PUT",
    path: "/wallets/approval",
    body: { id: SAFE_NONEXISTENT_ID, actionType: "create", creator: "smoke-test" },
  },

  // Institution approvals
  { name: "approvals.institutions       (queue)", method: "GET", path: "/financial-institutions" },
  {
    name: "approvals.institutionActions (dir)",
    method: "GET",
    path: "/financial-institutions/get/actions",
  },
  {
    name: "approvals.approveInstitution (apply)",
    method: "PUT",
    path: "/financial-institutions/approval",
    body: { id: NONEXISTENT_INSTITUTION_CODE, institutionId: NONEXISTENT_INSTITUTION_CODE, approvalStatus: "Approved" },
  },
  {
    name: "approvals.rejectInstitution      (reject body-only)",
    method: "PUT",
    path: "/financial-institutions/reject",
    body: { approvalStatus: "Rejected" },
  },
  {
    name: "approvals.rejectInstitutionById  (reject by id)",
    method: "PUT",
    path: `/financial-institutions/reject/${NONEXISTENT_INSTITUTION_CODE}`,
    body: { id: NONEXISTENT_INSTITUTION_CODE, approvalStatus: "Rejected" },
  },

  // Change requests fallback (kept for completeness)
  {
    name: "changeRequests.submit (legacy fallback)",
    method: "POST",
    path: "/change-requests/submit",
    body: { resourceType: "wallet.create", summary: "smoke-test", payload: {}, requestedBy: "smoke-test" },
  },
];

function classify(status) {
  if (status === 0) return "NETWORK";
  if (status === 200 || status === 204) return "OK";
  if (status === 400) return "BAD_REQ";
  if (status === 401 || status === 403) return "AUTH";
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
    "auth-token": SESSION_TOKEN,
  };
  const init = { method: ep.method, headers, redirect: "manual" };
  if (ep.method !== "GET" && ep.method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(ep.body || {});
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
    let summary = bodyText.slice(0, 200).replace(/\s+/g, " ").trim();
    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* ignore */
    }
    if (parsed && typeof parsed === "object") {
      const apiCode = parsed.code != null ? `code=${parsed.code} ` : "";
      const apiMsg =
        parsed.message ||
        parsed.error ||
        (parsed.data && typeof parsed.data === "object" ? parsed.data.message : null) ||
        parsed.status ||
        "";
      const arrayLen = Array.isArray(parsed.data)
        ? ` items=${parsed.data.length}`
        : Array.isArray(parsed)
          ? ` items=${parsed.length}`
          : "";
      summary = `${apiCode}${String(apiMsg).slice(0, 160)}${arrayLen}`;
    }
    return {
      ...ep,
      status: response.status,
      classification: classify(response.status),
      ms,
      body: summary,
      raw: parsed,
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
  console.log(`Testing ${endpoints.length} approval endpoints against ${API_BASE}`);
  console.log(`Session token: ${SESSION_TOKEN.slice(0, 16)}...${SESSION_TOKEN.slice(-8)}`);
  console.log("");

  const results = [];
  for (const ep of endpoints) {
    const r = await callEndpoint(ep);
    results.push(r);
    const tag = r.classification.padEnd(13);
    const status = String(r.status).padStart(3);
    const method = ep.method.padEnd(6);
    console.log(`${tag} ${status} ${method} ${ep.path}`);
    if (r.body) console.log(`  → ${r.body}`);
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
    ["MISSING", "WRONG_METHOD", "SERVER", "NETWORK"].includes(r.classification)
  );
  if (problems.length) {
    console.log("");
    console.log("--- Problems ---");
    for (const p of problems) {
      console.log(
        `${p.classification.padEnd(13)} ${p.method.padEnd(6)} ${p.path}\n  → ${p.body || "(no body)"}`
      );
    }
  }

  // Surface read endpoints that succeeded so we can see if data is actually returned.
  const successfulReads = results.filter(
    (r) => r.method === "GET" && r.classification === "OK"
  );
  if (successfulReads.length) {
    console.log("");
    console.log("--- Successful reads ---");
    for (const r of successfulReads) {
      const items = Array.isArray(r.raw)
        ? r.raw.length
        : Array.isArray(r.raw?.data)
          ? r.raw.data.length
          : "?";
      console.log(`${r.method.padEnd(6)} ${r.path}  items=${items}`);
    }
  }
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
