# Backend & frontend integration — engineer handoff

This document is **self-contained**: you can apply everything in **§7** in your own API repository without receiving our backend source tree. It lists issues found, **exact backend patches** to apply, remaining product/API work, and how the SPA now calls the API.

**Typical Java package paths** (adjust if your tree differs):

- `.../app/services/WalletsService.java`
- `.../app/services/UsersService.java`
- `.../app/services/TransactionsService.java`
- `.../app/services/FinancialInstitutionsService.java`

---

## 1. Summary for leadership

| Area | What was wrong | What to do |
|------|------------------|------------|
| `GET /wallets/get` | Global list used `baseAmount` + `WalletMapperAdmin` while per-institution list did not → **500** / mapper–DB mismatch risk | Align SQL + mapper with institution list (see **§7.1**) |
| Pending wallet SQL | Missing space → **`?ORDER BY`** invalid SQL | Fix string concat (see **§7.1**) |
| Role lookup SQL | `OR` / `AND` precedence wrong → wrong role or `-100` / auth bugs | Add parentheses (see **§7.1–7.4**) |
| User pending checks | `OR` / `AND` ambiguity in COUNT | Parenthesize (see **§7.2**) |
| User pending fetch | Same `?ORDER` risk | Space before `ORDER BY` (see **§7.2**) |
| `PUT /wallets/approval` | Clients sending `approvalStatus` only; API expects **`id`**, **`actionType`**, **`creator`** | Document + align clients (see **§2**); SPA already updated |

---

## 2. Frontend contract — `PUT /wallets/approval` (backend must match or document)

**Controller:** `WalletsController.WalletApprovals` passes to service:

- `wallet.getId()` — **operation row id** in `tbl_wallets_operations`, not necessarily `tbl_wallets.id`
- `wallet.getActionType()` — values used in switch: **`delete`**, **`edit`**, **`assign`**, **`credit`**, **`debit`**, **`create`**, etc.
- `wallet.getCreator()` — **approver username** (passed as `username` into `WalletApprovals`)

The SPA **must not** send only `approvalStatus: "Approved"`; that field is **not** what `WalletApprovals` uses.

**Frontend (product SPA) was updated to:**

- Load wallet “approvals” from **`GET /wallets/get/actions`** (pending operations), not `GET /wallets/get` (wallet catalog).
- Call **`PUT /wallets/approval`** with JSON: **`id`**, **`actionType`**, **`creator`** (approver identity).

---

## 3. Backend work still required (product / API gaps)

### 3.1 Wallet operation **reject**

`WalletsService.WalletApprovals` has **no** branch for rejecting a pending operation (e.g. delete row from `tbl_wallets_operations` without applying). If product needs **Reject**, add:

- Explicit **`actionType`** or flag for reject, **or**
- A separate endpoint, **or**
- Document that reject is unsupported.

Until then, the SPA may **hide or disable** wallet reject in UI.

### 3.2 User / institution approval payloads

Confirm OpenAPI / implementation for:

- `PUT /users/approval` — body fields expected vs SPA `{ id, userId, approvalStatus }`
- `PUT /financial-institutions/approval` — same for institution pendings

Align field names (`approvalStatus` vs internal names) or document the canonical JSON.

### 3.3 SQL / logic audit (recommended)

The following patterns appear elsewhere and deserve a **repo-wide audit** (not all patched in §7):

- `WHERE ... = ?` immediately concatenated with `"ORDER BY"` without a space
- `email_address = ? OR username = ? AND deleted = ...` without parentheses
- `WHERE ... email_address = ? || a.username = ?` — **`||` is string concat in SQL**, not OR (likely bugs in `UsersService` profile queries)

### 3.4 `GET /wallets/get` vs global users (`financial_institution_code = -1`)

After §7.1, if 500s persist, capture **DB stack traces** and confirm:

- Schema for `ajiswitch_db.tbl_wallets` vs query
- Whether global approvers should use a **different** list endpoint or filters

---

## 4. Frontend fixes already in SPA (no backend deploy)

- **`GET /wallets/get` fallback:** if list returns 500, aggregate **`GET /wallets/get/{code}`** using codes from **`GET /wallets/get/actions`** (defensive; primary fix is backend §7.1).
- **API error messages:** parse `{ status: "error", message, code }` for user-visible errors.
- **Debug logging:** gated by `import.meta.env.DEV` or `VITE_DEBUG_API=true` (see `.env.example`).
- **Wallet approvals:** correct data source + **`PUT /wallets/approval`** body as in §2.
- **Disputes / misc:** detail fetch, amount null-safe, user approval button colours.

---

## 5. Quick verification checklist (after backend deploy)

1. Login as **Approver**; confirm `auth-token` + `Authorization` on calls.
2. **`GET /wallets/get`** — 200 + data (or documented empty rules).
3. **`GET /wallets/get/actions`** — pending operations list.
4. **`PUT /wallets/approval`** with real **`id`**, **`actionType`**, **`creator`** — 2xx and DB updated as expected.
5. **`GET /users/get`**, **`GET /financial-institutions`**, **`GET /change-requests`** — role-scoped behaviour documented.

---

## 6. Repo layout (reference only)

| Path | Role |
|------|------|
| Transgate / SparkPay API service | Spring API — **deploy this** |
| Product SPA | Vite + React |
| Optional `spring-wrapper` | Thin SPA host — **not** the core wallet API |

**You do not need our backend zip** if you apply **§7** verbatim in your fork.

---

## 7. Backend patches to apply manually (copy-paste)

Apply each **FIND** → **REPLACE** in the listed file. If your code already matches **REPLACE**, skip that item.

### 7.1 `WalletsService.java`

#### A. `GetUserRole` — fix `AND` / `OR` precedence

**FIND:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE email_address = ? OR username = ? AND deleted = 0 AND session_token = ?";
```

**REPLACE WITH:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE (email_address = ? OR username = ?) AND deleted = 0 AND session_token = ?";
```

#### B. `GetWalletsFromPendings` — space before `ORDER BY` (avoids `?ORDER BY`)

**FIND:**

```text
                    + "WHERE a.id = ? AND a.actionType = ?"
                    + "ORDER BY a.id DESC";
```

**REPLACE WITH:**

```text
                    + "WHERE a.id = ? AND a.actionType = ? "
                    + "ORDER BY a.id DESC";
```

#### C. `GetWallets()` (no-arg) — align with `GetWallets(institutioncode)` + use `WalletMapper`

**FIND** the `GetWallets()` method body that builds `SQL` for the **global** list (it likely references `baseAmount` and uses `new WalletMapperAdmin()`). Replace the **entire** `SQL = "SELECT ...` assignment and the following `jdbcTemplate.query` line with:

```text
            // Same column set as GetWallets(institutioncode) + WalletMapper — avoids failures when
            // `baseAmount` is absent or differs on some DBs (WalletMapperAdmin required that column).
            SQL = "SELECT a.id, a.walletnumber, a.walletname, a.creator, a.creationdate, a.financialinstitutioncode, a.balance, a.lien, a.wallettype, a.is_active, "
                    + "b.name as financialInstitutionname "
                    + "FROM ajiswitch_db.tbl_wallets a "
                    + "LEFT JOIN tbl_financial_institutions b "
                    + "ON a.financialinstitutioncode = b.code "
                    + "ORDER BY a.id DESC";
            List<WalletModel> wallets = jdbcTemplate.query(SQL, new WalletMapper());
```

**Remove** any previous lines in that method that selected `a.baseAmount` or used `new WalletMapperAdmin()` for this query.

---

### 7.2 `UsersService.java`

#### A. `GetUserRole` — same precedence fix as wallets

**FIND:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE email_address = ? OR username = ? AND deleted = 0 AND session_token = ?";
```

**REPLACE WITH:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE (email_address = ? OR username = ?) AND deleted = 0 AND session_token = ?";
```

#### B. `CheckUserPending` — parenthesize `OR` / `AND`

**FIND:**

```text
SQL = "SELECT COUNT(*) FROM tbl_user_details_operations WHERE username = ? AND actionType = ? OR email_address = ? AND actionType = ?";
```

**REPLACE WITH:**

```text
SQL = "SELECT COUNT(*) FROM tbl_user_details_operations WHERE (username = ? AND actionType = ?) OR (email_address = ? AND actionType = ?)";
```

#### C. `GetUserFromPendings` — space before `ORDER BY`

**FIND:**

```text
                    + "WHERE a.id = ? AND a.actionType = ?"
                    + "ORDER BY a.id DESC";
```

**REPLACE WITH:**

```text
                    + "WHERE a.id = ? AND a.actionType = ? "
                    + "ORDER BY a.id DESC";
```

---

### 7.3 `TransactionsService.java`

#### `GetUserRole` — same precedence fix

**FIND:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE email_address = ? OR username = ? AND deleted = 0 AND session_token = ?";
```

**REPLACE WITH:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE (email_address = ? OR username = ?) AND deleted = 0 AND session_token = ?";
```

---

### 7.4 `FinancialInstitutionsService.java`

#### `GetUserRole` — same precedence fix

**FIND:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE email_address = ? OR username = ? AND deleted = 0 AND session_token = ?";
```

**REPLACE WITH:**

```text
String SQL = "SELECT role FROM tbl_user_details WHERE (email_address = ? OR username = ?) AND deleted = 0 AND session_token = ?";
```

---

### 7.5 After applying patches

1. Run **`mvn compile`** (or your CI build) on the API module.
2. Run integration tests against **`GET /wallets/get`**, **`GET /wallets/get/actions`**, **`PUT /wallets/approval`**.
3. Deploy to the environment the SPA points at (`VITE_DEV_API_PROXY_TARGET` / production gateway).

---

## 8. Optional: rationale (for code review)

- **`GetWallets()` vs institution-scoped query:** the institution-scoped path did not expose `baseAmount` in the SELECT but the global path did and used `WalletMapperAdmin`, which always reads `baseAmount` from the `ResultSet`. Any mismatch (missing column, alias case, etc.) surfaces as **500**. Using the **same SELECT list** and **`WalletMapper`** as the institution endpoint removes that inconsistency.
- **`?ORDER BY`:** Java string concatenation of `"... = ?"` and `"ORDER BY..."` without a trailing space on the first fragment produces invalid SQL; a single trailing space before `ORDER BY` fixes it.
- **`GetUserRole`:** Without parentheses, SQL evaluates `OR` before `AND` in a way that does not match “match this user AND deleted = 0 AND session matches”.

---

*End of handoff document.*
