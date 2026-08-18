# Role 4 — Third Party Vendor (FI contact) — Frontend brief

**Transgate / switch payments — cards excluded**

---

## Role identity

| Item | Value |
|------|--------|
| **Role ID** | `4` |
| **Label** | `"Third Party Vendor"` (from `tbl_role.role_name` / login) |
| **Who they are** | Financial institution contact — portal user for one FI on **Transgate** |
| **Institution link** | `tbl_financial_institution_contacts` → `financial_institution_code` |
| **Not the same as** | **Role 5** (`financial_institution_user`) — cards-only |

---

## SPA implementation (this repo)

| Area | Implementation |
|------|----------------|
| Role detection | [`src/app/utils/roleAccess.js`](../src/app/utils/roleAccess.js) — `isThirdPartyVendor(user)` via `roleId === 4` |
| Auth / menus | [`src/app/services/auth.js`](../src/app/services/auth.js) persists `transgateMenu`, `sparkpayMenu` on login |
| Sidebar | [`src/app/utils/transgateMenu.js`](../src/app/utils/transgateMenu.js) maps API menu paths → SPA routes; fallback menu if empty |
| Route guards | [`src/app/components/layout/AppLayout.jsx`](../src/app/components/layout/AppLayout.jsx) — `hasRouteAccess` + vendor-only nav |
| Disputes | [`/disputes/log`](../src/app/pages/disputes/LogDispute.jsx) direct `createDispute` for vendors; [`/disputes`](../src/app/pages/disputes/DisputesList.jsx) list + approve |
| FI-scoped APIs | Transactions, dashboards, wallets, disputes services pass `institutionCode` when `requiresInstitutionScope()` |

**Out of scope (phase 2):** settlements UI, Sparkpay/cards (`sparkpayMenu`).

---

## Auth headers

| Header | Value |
|--------|--------|
| `Authorization` | App static header |
| `auth-token` | `session_token` from login |
| `Accept` | `application/json` |

---

## Login session fields

Store on user object after login:

- `roleId` / `roleName`
- `institutionCode` / `institutionName`
- `transgateMenu` — sidebar source (`role_id` 0 + 4, `access = 1`)
- `sparkpayMenu` — cards; hidden for Transgate-only vendors

---

## Institution scoping (frontend must enforce)

Always use login **`financial_institution_code`** as:

- Path params `{institutioncode}` / `{institution}`
- `userInstitutionCode` on transaction search
- Dispute / wallet filters for the contact's FI

Backend may not block cross-FI codes for role 4 — the SPA enforces scope in services and pages.

**Avoid:** `GET /transactions`, `GET /wallets/get` without institution code.

---

## Capabilities summary

| Area | Role 4 |
|------|--------|
| Account / 2FA / profile | Yes |
| Switch transactions | Read/search (FI-scoped) |
| Switch disputes | Log + approve + list (FI-scoped) |
| Status change | Submit request (`POST /transaction/status/change`) |
| Wallets | Read only |
| FI & contacts | Read only |
| Users / admin / approvals | No |
| Cards | Out of scope |

---

## Manual QA checklist

Test with a **role 4** user tied to one FI:

1. [ ] Login — sidebar matches `transgateMenu` (or fallback); FI name/code shown in header.
2. [ ] Dashboard — metrics use `.../institution/{code}` only; institution filter locked to FI.
3. [ ] Transactions — list uses institution endpoint/search with `userInstitutionCode`; no global `GET /transactions`.
4. [ ] Log dispute — `PUT /transactions/disputes/create` (not change-request hub).
5. [ ] Disputes list (`/disputes`) — FI-scoped; accept/reject calls `POST /transactions/disputes/approve`.
6. [ ] Wallets — view/activity only; `/wallets/create`, `/wallets/fund` blocked.
7. [ ] `/admin/*`, `/approvals/*`, live monitoring, institution-activity blocked.
8. [ ] Transaction detail — “Request status change” submits successfully.

---

## One-line summary

**Role 4 is the FI contact on Transgate: institution-scoped monitoring, switch dispute logging/approval, read-only wallets, and profile/auth — no user/FI/wallet admin and no cards unless `sparkpayMenu` is enabled later.**
