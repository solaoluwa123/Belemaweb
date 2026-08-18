# Sparkpay API reference (OpenAPI 3.0.1)

This document describes the API implied by the OpenAPI specification used for integration. **Base URL** in that spec: `http://172.17.10.128:8077/sparkpayapi` (use your environment’s host, port, and context path in practice).

The spec marks most **200** responses as `application/json` with schema `string`; in practice the server often returns JSON objects or wrapped strings. Treat payloads as JSON unless you know otherwise.

---

## 1. How to call the API

- **Prefix every path** with the server URL, e.g. `GET http://172.17.10.128:8077/sparkpayapi/transactions`.
- **JSON bodies**: send `Content-Type: application/json` when `requestBody` is required.
- **Accept**: many operations allow `Accept: application/json` (optional in some operations).
- **HTTP methods**: the API uses **PUT** heavily for create/approve-style actions; **POST** for some updates and searches. This matches the spec as generated (not necessarily REST-idiomatic).

---

## 2. Authentication and headers

| Header | Typical use |
|--------|-------------|
| **Authorization** | Required on almost all protected routes. Format is not in the spec; commonly `Bearer <token>` or a custom scheme—confirm with your backend team. |
| **auth-token** | Required on many routes that perform actions or read sensitive data (per-path in the spec). |
**Login** (`POST /users/login`) only requires **Authorization** + body in the spec; **2FA** (`POST /users/login-2fa`) adds **auth-token**.

**Cron / maintenance** endpoints under `/app/crons/...` and some `/users/crons/...` **GET** routes only require **Accept** (or nothing)—treat as **server-to-server**; do not expose publicly without network controls.

---

## 3. Shared request/response models (schemas)

Field meanings below are **inferred from names**; business rules live in the backend services.

### `LoginRequest`

- `username` (string)
- `password` (string)

### `LoginResponse` / `UserModel` (overlap)

User profile fields include: `id`, `roleid`, `code`, `twofaenabled`, `status`, `role`, `message`, `username`, `firstname`, `surname`, `phone_number`, `email_address`, dates, `session_token`, `last_login`, `financial_institution_code`, `financial_institution_name`, `twofasecretkey`, `transgateMenu`, `sparkpayMenu` (arrays of `MenuModel`), plus action fields like `actionType`, `note`, `institution`, etc.

### `MenuModel`

`id`, `role_id`, `parent_id`, `child_id`, `label`, `icon`, `path`, `child_label`, `child_path`.

### `WalletModel`

`creator`, `walletname`, `walletnumber`, dates, `financialInstitutionCode`, `financialInstitutionName`, `baseAmount`, `id`, `wallettype`, `amount`, `balance`, `lien`, `actionType`, `assignnee`, `note`, `walletTypeName`, `status`.

### `FinancialInstitutionModel`

`id`, `businessType`, `port_number`, `isProcessTSQ`, `name`, `shortName`, `code`, `color`, `business_address`, dates, `businessTypeName`, `created_by`, `actionType`, `note`, `status`, keys (`publickeylocation`, `publickeylocationLinux`, `hashKey`, `password`), `cbn_bank_account`, `switch_code`, `vat`, `charge_amount`.

### `TransactionModel` / `DisputeModel`

Rich transfer fields: session IDs, accounts, institutions, amounts, response codes, channel, narration, dates, etc.

**Dispute-specific**: `loggedBy`, `dateCreated`, `dateModified`, `transactionId`, `status`, `resolved`, `resolvedBy`, `records`, `timeline_date`, `proof_of_reject_uri`, `loggingInstitution`, `selectedDisputes`, and related fields.

---

## 4. Endpoints by functional area

For each entry: **Method** `Path` — **operationId** — short purpose; **Body** = JSON schema ref; **Params** = path/query/header highlights.

### 4.1 Wallets (`wallets-controller`)

| Method | Path | operationId | Body | Notes |
|--------|------|-------------|------|--------|
| PUT | `/wallets/map-wallet-to-user` | MapWalletToUser | `WalletModel` | Auth + auth-token |
| PUT | `/wallets/initiate-debit-credit` | InitiateDebitCreditWallet | `WalletModel` | |
| PUT | `/wallets/create` | Create | `WalletModel` | |
| PUT | `/wallets/approval` | WalletApprovals | `WalletModel` | |
| POST | `/wallets/edit` | EditWallet | `WalletModel` | |
| GET | `/wallets/get` | GetAll | — | Auth only |
| GET | `/wallets/get/{institutioncode}` | GetAll_1 | — | Path: institution code |
| GET | `/wallets/get/actions` | GetWalletsForActions | — | |
| GET | `/wallet/{walletnumber}` | GetWalletByNumber | — | Auth + auth-token |
| GET | `/wallet/activity/{walletnumber}` | GetWalletActivity | — | Query: `startDate`, `endDate`, `page`, `limit`, `isCurrent` (all required in spec) |
| DELETE | `/wallets/{walletnumber}/{username}` | DeleteWallet | — | |

---

### 4.2 Users & contacts (`users-controller`)

#### Registration / profile / security

| Method | Path | operationId | Body |
|--------|------|-------------|------|
| PUT | `/users/create` | Create_1 | `UserModel` |
| PUT | `/other-users/create` | CreateOther | `UserModel` |
| POST | `/users/edit` | Edit_7 | `UserModel` |
| POST | `/users/update-password` | UpdatePassword | `UserModel` |
| POST | `/users/update-names` | UpdateNames | `UserModel` |
| POST | `/users/setup-2fa` | SetUp2FA | `UserModel` |
| POST | `/users/resetpassword` | ResetPassword | `LoginResponse` |
| POST | `/users/recoverpassword` | SendPasswordRecoveryCode | `LoginRequest` |
| POST | `/users/activateaccount` | ActivateAccount | `LoginResponse` |
| POST | `/users/logout` | Logout | `LoginRequest` |
| POST | `/user/generate-token` | SignUser | `LoginRequest` | Header **auth** required |

#### Login

| Method | Path | operationId | Body | Headers |
|--------|------|-------------|------|---------|
| POST | `/users/login` | Login | `LoginRequest` | Authorization |
| POST | `/users/login-2fa` | Login2FA | `LoginRequest` | Authorization, auth-token |

#### Approvals / rejection

| Method | Path | operationId | Body / path |
|--------|------|-------------|-------------|
| PUT | `/users/approval` | UserApprovals | `UserModel` |
| PUT | `/users/contact/approval` | ContactApprovals | `UserModel` |
| PUT | `/users/reject/{id}` | Reject | path `id` (int) |
| PUT | `/contact/reject/{id}/{email}` | ContactReject | path `id`, `email` |

#### Reads

| Method | Path | operationId | Notes |
|--------|------|-------------|--------|
| GET | `/users/{userid}` | GetUserById | auth-token |
| GET | `/users/get` | GetUsers | |
| GET | `/users/get/actions` | GetUsersForActions | |
| GET | `/other-users/get` | GetOtherUsers | |
| GET | `/other-users/get/actions` | GetOtherUsersForActions | |
| GET | `/roles/get` | GetRoles | |
| GET | `/contacts/get/actions` | GetContactUsersForActions | |

#### Cron-style (typically internal)

| Method | Path | operationId |
|--------|------|-------------|
| GET | `/users/crons/unlock` | Unlock |
| GET | `/users/crons/reducelocktime` | ReduceLockTime |
| GET | `/app/crons/senddisputesreminders` | SendDisputesReminders |
| GET | `/app/crons/sendaccepteddisputes` | SendAllAcceptedDisputes |
| GET | `/app/crons/autopassdisputesforsettlement` | AutoPassDisputesForSettlement |
| GET | `/app/crons/autopassarbitrateddisputesforsettlement` | autoPassArbitratedDisputesForSettlement |

#### Delete

| Method | Path | operationId |
|--------|------|-------------|
| DELETE | `/users/{userid}/{username}` | Delete |

---

### 4.3 Financial institutions (`financial-institutions-controller`)

| Method | Path | operationId | Body / notes |
|--------|------|-------------|--------------|
| GET | `/financial-institutions` | Get_2 | Auth only |
| PUT | `/financial-institutions` | Create_3 | `FinancialInstitutionModel` |
| POST | `/financial-institutions` | Edit_8 | `FinancialInstitutionModel` |
| PUT | `/financial-institutions/approval` | UserApprovals_1 | `FinancialInstitutionModel` |
| PUT | `/financial-institutions/reject` | FinancialInstitutionReject | `FinancialInstitutionModel` |
| PUT | `/financial-institutions/reject/{id}` | Reject_1 | path id |
| GET | `/financial-institutions/{code}` | GetFinancialInstitutionByCode | auth-token |
| GET | `/financial-institutions/{code}/{username}` | Activate | |
| DELETE | `/financial-institutions/{code}/{username}` | Delete_1 | |
| GET | `/financial-institutions/types` | GetTypes | |
| GET | `/financial-institutions/types/{id}` | GetFinancialInstitutionsTypeById | |
| GET | `/financial-institutions/get/actions` | GetWalletsForActions_1 | |

#### Contacts (institution)

| Method | Path | operationId | Body |
|--------|------|-------------|------|
| GET | `/financial-institutions/contacts` | GetContacts | |
| PUT | `/financial-institutions/contacts` | CreateContact | `UserModel` |
| POST | `/financial-institutions/contacts` | Edit_9 | `UserModel` |
| GET | `/financial-institutions/contacts/{id}` | GetContactById | |
| GET | `/financial-institutions/contacts/institution/{code}` | GetContactsByInstitution | |
| GET | `/financial-institutions/contacts/institution/get/actions/{code}` | GetContactsByInstitutionForAction | |
| GET | `/financial-institutions/contacts/get/actions` | GetContactsForAction | |
| DELETE | `/financial-institutions/contacts/{email}/{username}` | DeleteContact | |

---

### 4.4 Switch transactions & disputes (`transactions-controller`)

#### Disputes (switch)

| Method | Path | operationId | Body / query |
|--------|------|-------------|--------------|
| PUT | `/transactions/disputes/create` | Create_2 | `DisputeModel` |
| PUT | `/transactions/disputes/create/bulk` | CreateBulkDisputes | `DisputeModel` |
| POST | `/transactions/disputes/approve` | ApproveSettlement | `DisputeModel` |
| GET | `/transactions/disputes/types/get` | GetDisputeTypes | |
| GET | `/transactions/disputes/q/search` | SearchTransactionsDisputes | Query: optional filters + required `page`, `limit` |
| GET | `/transactions/disputes/institution/{institutioncode}` | GetDisputes | `page`, `limit` |
| GET | `/transactions/disputes/get/{id}` | GetDisputesOne | |

#### Transactions read/search

| Method | Path | operationId | Notes |
|--------|------|-------------|--------|
| GET | `/transactions` | Get | |
| GET | `/transactions/{sessionid}` | GetOne | auth-token |
| GET | `/transactions-by-session-id/{sessionid}` | GetOneBySessionId | query `isCurrent` |
| POST | `/transactions-by-session-ids` | SearchTransactionsForSessionIds | `TransactionModel` body |
| POST | `/transactions-by-session-ids/with/date` | SearchTransactionsForSessionIdsWithDate | query `startDate`, `endDate` + body |
| GET | `/transactions/q/search` | SearchTransactions | Many **required** query filters (session, channel, accounts, institutions, amounts, dates, page, limit, `isCurrent`, `userInstitutionCode`) |
| GET | `/transactions/institution/{institutioncode}` | GetInstitutionTransactions | |
| GET | `/transactions-by-date` | Get_1 | date range + pagination + `isCurrent` |
| GET | `/transactions-by-date/institution/{institutioncode}` | GetInstitutionTransactions_1 | |
| GET | `/transactions-by-date-only` | getTransactionsByDateOnly | |
| GET | `/transactions-by-date-only/institution/{institutioncode}` | getInstitutionTransactionsByDateOnly | |

#### Settlements (under transactions tag)

| Method | Path | operationId |
|--------|------|-------------|
| GET | `/transactions/settlements/institution/{institutioncode}` | GetSettlements |
| GET | `/transactions/settlements/get/{id}` | GetSettlementsOne |

#### Status change

| Method | Path | operationId | Body |
|--------|------|-------------|------|
| POST | `/transaction/status/change` | RequestTransactionStatusChange | `DisputeModel` |

#### Analytics / dashboards (representative)

- **Trend**: `GET /transactions-trend/{institutioncode}` — query `startDate`, `endDate`, `type`.
- **Volume**: `GET /transactions-summary`, `GET /transactions-summary/institution/{institutioncode}`.
- **Rates**: `GET /transactions-rates`, inward variants, per-institution variants.
- **Channels**: `GET /transactions-by-channels`, institution variant.
- **Failures**: `GET /top-failing-institutions`, `GET /top-failed-response-codes`, institution variants, `GET /all-failed-response-codes/institution/{institutioncode}`.
- **Success counts**: `GET /successful-transaction-count`, institution variant.
- **FT timing**: `GET /ft-average-time`, institution variant.
- **Commissions**: `GET /commissions/{institutioncode}`.
- **Timeout retries**: `GET /timeoutretries/q/search`, `GET /timeoutretries-by-date`.

#### Generic transaction maintenance

| Method | Path | operationId |
|--------|------|-------------|
| GET | `/transactions-for-update` | GetTNXStatusChange | Many required query params for workflow filtering |

---

### 4.5 Out of scope: card / Acquirer modules

The upstream OpenAPI may still describe **card** and **acquirer** routes (under paths such as `/cards/...` and `cardpayments`). This **Transgate / switch** web app does not call those modules; they are omitted here. Use the canonical OpenAPI JSON if you need them.

#### Generic (non-card) misc examples

`GET /smartdets`, `GET /settlementsummary`, `GET /settlements`, `GET /settlements/institution/{institution}`, `GET /settlements/institution/search/{institution}`, `GET /gapspayments`, `GET /nuspayments/{institutioncode}`. Each has required query parameters in the spec (date range; some add pagination and filters).

---

## 5. Practical notes for integrators

1. **Required query parameters**: Several `GET` operations mark filters as `required: true` even when you might want “optional” search—clients may need to send empty strings or sentinel values; confirm with backend behavior.
2. **`approve_reject_bulk`**: Documented as **POST** with **only query parameters** and response `*/*` object—verify encoding and length limits for `selectedDisputes` (if your deployment exposes it).
3. **Security**: Protect cron routes; do not rely on obscurity.
4. **Errors**: The source spec only defines **200 OK**; real deployments will return **4xx/5xx** with bodies not described in that snippet.

---

## 6. Source

Derived from the OpenAPI 3.0.1 definition (title **OpenAPI definition**, version **v0**). Update this file when the canonical OpenAPI JSON changes.
