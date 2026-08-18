# API Screen Mapping

This document maps the current React UI screens to the backend endpoints exposed by the Swagger spec at:

- `http://172.17.10.128:8077/sparkpayapi/swagger-ui/index.html`

Important context:

- The frontend is still mostly mock-data driven.
- The endpoints below are the backend endpoints the current UI screens will need when connected to the real API.
- Some screens may need more than one endpoint for listing, filtering, detail view, create, approve, reject, or export.
- A few frontend flows do not have a clearly matching endpoint in the current Swagger spec; those are called out explicitly.

## Authentication

### `src/app/pages/auth/Login.jsx`
- `POST /users/login`
- `POST /users/login-2fa`

### `src/app/components/layout/AppLayout.jsx`
- `POST /users/logout`

### `src/app/pages/auth/password-recovery/ForgotPasswordPage.jsx`
- `POST /users/recoverpassword`

### `src/app/pages/auth/password-recovery/ResetPasswordPage.jsx`
- `POST /users/resetpassword`

### `src/app/pages/auth/password-recovery/ForcedPasswordChangePage.jsx`
- `POST /users/update-password`

### `src/app/pages/auth/activation/CredentialSetupPage.jsx`
- `POST /users/activateaccount`

### `src/app/pages/auth/activation/MfaSetupPage.jsx`
- `POST /users/setup-2fa`

### `src/app/pages/auth/activation/ActivationRequestPage.jsx`
- `POST /user/generate-token`
- `POST /users/activateaccount`

### `src/app/pages/auth/activation/TokenProcessingPage.jsx`
- No clearly named token-validation endpoint is exposed in the current Swagger spec.
- Backend clarification is needed here if the token must be validated before activation continues.

## Accounts Dashboard And Statistics

### `src/app/pages/dashboards/TransgateDashboard.jsx`
- `GET /transactions-summary`
- `GET /transactions-summary/institution/{institutioncode}`
- `GET /successful-transaction-count`
- `GET /successful-transaction-count/institution/{institutioncode}`
- `GET /transactions-by-date`
- `GET /transactions-by-date/institution/{institutioncode}`
- `GET /transactions-by-channels`
- `GET /transactions-by-channels/institution/{institutioncode}`
- `GET /top-failed-response-codes`
- `GET /top-failed-response-codes/institution/{institutioncode}`
- `GET /top-failing-institutions`
- `GET /top-failing-institutions/institution/{institutioncode}`
- `GET /ft-average-time`
- `GET /ft-average-time/institution/{institutioncode}`
- `GET /transactions-trend/{institutioncode}`

### `src/app/pages/dashboards/LiveMonitoring.jsx`
- No clearly named live monitoring endpoint is exposed in the current Swagger spec.
- Backend clarification is needed for real-time inflow/outflow by institution, so the frontend can only show a graceful blocker state for this screen for now.

### `src/app/components/dashboard/StatisticsSection.jsx`
- `GET /successful-transaction-count`
- `GET /successful-transaction-count/institution/{institutioncode}`
- `GET /transactions-by-channels`
- `GET /transactions-by-channels/institution/{institutioncode}`
- `GET /top-failed-response-codes`
- `GET /top-failed-response-codes/institution/{institutioncode}`
- `GET /top-failing-institutions`
- `GET /top-failing-institutions/institution/{institutioncode}`
- `GET /ft-average-time`
- `GET /ft-average-time/institution/{institutioncode}`

## Transactions

### `src/app/pages/transactions/TransactionList.jsx`
- `GET /transactions`
- `GET /transactions/q/search`
- `GET /transactions/institution/{institutioncode}`
- `GET /transactions-by-date`
- `GET /transactions-by-date/institution/{institutioncode}`

### `src/app/pages/transactions/TransactionDetails.jsx`
- `GET /transactions/{sessionid}`
- `GET /transactions-by-session-id/{sessionid}`

### `src/app/pages/transactions/TransactionStatusChanges.jsx`
- `POST /transaction/status/change`
- `GET /transactions-for-update`

### `src/app/pages/transactions/LiveTransactions.jsx`
- `GET /transactions`
- `GET /transactions-for-update`

## Disputes

### `src/app/pages/disputes/LogDispute.jsx`
- `PUT /transactions/disputes/create`

### `src/app/pages/disputes/ApproveDisputes.jsx`
- `GET /transactions/disputes/institution/{institutioncode}`
- `GET /transactions/disputes/q/search`
- `POST /transactions/disputes/approve`
- No clearly named reject endpoint is exposed in the current Swagger spec for account disputes.

### `src/app/pages/disputes/BulkDisputeApproval.jsx`
- `GET /transactions/disputes/institution/{institutioncode}`
- `POST /transactions/disputes/approve`
- `PUT /transactions/disputes/create/bulk`
- Backend clarification is still needed for the bulk upload request payload and file format contract.

### `src/app/pages/disputes/DisputeHistory.jsx`
- `GET /transactions/disputes/q/search`
- `GET /transactions/disputes/get/{id}`

### `src/app/pages/disputes/ArbitratedDisputes.jsx`
- `GET /transactions/disputes/institution/{institutioncode}`

## Wallets

### `src/app/pages/wallets/WalletList.jsx`
- `GET /wallets/get`
- `GET /wallets/get/{institutioncode}`
- `GET /wallets/get/actions`
- `PUT /wallets/create`
- `PUT /wallets/edit`
- No clearly named wallet funding endpoint is exposed in the current Swagger spec.

### `src/app/pages/wallets/WalletActivity.jsx`
- `GET /wallet/{walletnumber}`
- `GET /wallet/activity/{walletnumber}`

## Approvals

### `src/app/pages/approvals/PendingUserApprovals.jsx`
- `GET /users/get`
- `GET /users/get/actions`
- `PUT /users/approval`
- `PUT /users/reject/{id}`

### `src/app/pages/approvals/WalletApprovals.jsx`
- `GET /wallets/get`
- `GET /wallets/get/actions`
- `PUT /wallets/approval`
- No clearly named reject endpoint is exposed in the current Swagger spec for wallet approvals.

### `src/app/pages/approvals/InstitutionApprovals.jsx`
- `GET /financial-institutions`
- `GET /financial-institutions/get/actions`
- `PUT /financial-institutions/approval`
- `PUT /financial-institutions/reject`
- `PUT /financial-institutions/reject/{id}`

### `src/app/pages/approvals/TransactionApprovalsAccounts.jsx`
- `POST /transaction/status/change`
- `GET /transactions-for-update`

### `src/app/pages/approvals/TransactionApprovalsCards.jsx`
- `POST /transaction/status/change`
- No clearly matching card-specific queue/read endpoint is exposed in the current Swagger spec for this approvals screen.

## Settlements

### `src/app/pages/settlements/SettlementRecords.jsx`
- `GET /settlements`
- `GET /settlements/institution/{institution}`
- `GET /settlements/institution/search/{institution}`

### `src/app/pages/settlements/SettlementSummary.jsx`
- `GET /settlementsummary`

### `src/app/pages/settlements/Smartdets.jsx`
- `GET /smartdets`

### `src/app/pages/settlements/CommissionReports.jsx`
- `GET /commissions/{institutioncode}`

### `src/app/pages/settlements/TimeoutRetries.jsx`
- `GET /timeoutretries/q/search`
- `GET /timeoutretries-by-date`

### `src/app/pages/settlements/TSQRetryManagement.jsx`
- No clearly matching endpoint is exposed in the current Swagger spec.
- Backend clarification is needed for this screen.

## Admin

### `src/app/pages/admin/UsersManagement.jsx`
- `GET /users/get`
- `GET /users/get/actions`
- `PUT /users/create`
- `POST /users/edit`
- `PUT /users/reject/{id}`
- `DELETE /users/{userid}/{username}`

### `src/app/pages/admin/FinancialInstitutions.jsx`
- `GET /financial-institutions`
- `GET /financial-institutions/{code}`
- `GET /financial-institutions/get/actions`
- `GET /financial-institutions/types`
- `POST /financial-institutions`
- `PUT /financial-institutions`
- `DELETE /financial-institutions/{code}/{username}`

### `src/app/pages/admin/InstitutionContacts.jsx`
- `GET /financial-institutions/contacts`
- `GET /financial-institutions/contacts/{id}`
- `GET /financial-institutions/contacts/get/actions`
- `GET /financial-institutions/contacts/institution/{code}`
- `GET /financial-institutions/contacts/institution/get/actions/{code}`
- `POST /financial-institutions/contacts`
- `PUT /financial-institutions/contacts`
- `DELETE /financial-institutions/contacts/{email}/{username}`
- `PUT /contact/reject/{id}/{email}`

## Cards Dashboard And Charts

### `src/app/pages/dashboards/E-Transactdashboard.jsx`
- `GET /cards/successful-transactions-count`
- `GET /cards/successful-transaction-count/institution/{institutioncode}`
- `GET /cards/top-failed-response-codes`
- `GET /cards/top-failed-response-codes/institution/{institutioncode}`
- `GET /cards/transactions-by-date`
- `GET /cards/transactions-by-date/institution/{institution}`
- `GET /cards/transactions-by-merchant`
- `GET /cards/transactions-by-channels/institution/{institutioncode}`
- `GET /cards/settlementsummary`

## Cards Reference Data

### `src/app/pages/cards/Nodes.jsx`
- `GET /cards/nodes`
- `GET /cards/nodes/get/actions`
- `GET /cards/nodes/q/search`
- `PUT /cards/nodes`
- `PUT /cards/nodes/{id}`
- `PUT /cards/nodes/{type}/{id}`
- `PUT /cards/nodes/reject/{type}/{id}`
- `DELETE /cards/nodes/{id}`

### `src/app/pages/cards/Routes.jsx`
- `GET /cards/routes`
- `GET /cards/routes/get/actions`
- `GET /cards/routes/q/search`
- `PUT /cards/routes`
- `PUT /cards/routes/{id}`
- `PUT /cards/routes/{type}/{id}`
- `PUT /cards/routes/reject/{type}/{id}`
- `DELETE /cards/routes/{id}`

### `src/app/pages/cards/Terminals.jsx`
- `GET /cards/terminals`
- `GET /cards/terminals/get/actions`
- `GET /cards/terminals/institution/{institution}`
- `GET /cards/terminals/merchant/{merchantid}`
- `GET /cards/terminals/ptsp/{ptsp}`
- `GET /cards/terminals/q/search`
- `GET /cards/terminals/terminal-owner/{owner_id}`
- `PUT /cards/terminals`
- `PUT /cards/terminals/{terminal_id}`
- `PUT /cards/terminals/{type}/{id}`
- `PUT /cards/terminals/reject/{type}/{id}`
- `DELETE /cards/terminals/{id}`

### `src/app/pages/cards/TerminalOwners.jsx`
- `GET /cards/terminal-owners`
- `GET /cards/terminal-owners/get/actions`
- `GET /cards/terminal-owners/q/search`
- `PUT /cards/terminal-owners`
- `PUT /cards/terminal-owners/{owner_id}`
- `PUT /cards/terminal-owners/{type}/{id}`
- `PUT /cards/terminal-owners/reject/{type}/{id}`
- `DELETE /cards/terminal-owners/{id}`

### `src/app/pages/cards/Merchants.jsx`
- `GET /cards/merchants`
- `GET /cards/merchants/{merchant}`
- `GET /cards/merchants/get/actions`
- `GET /cards/merchants/institution/{institution}`
- `GET /cards/merchants/ptsp/{ptsp}`
- `GET /cards/merchants/q/search`
- `GET /cards/merchants/terminal-owner/{owner}`
- `PUT /cards/merchants`
- `PUT /cards/merchants/{merchant_id}`
- `PUT /cards/merchants/{type}/{id}`
- `PUT /cards/merchants/reject/{type}/{id}`
- `DELETE /cards/merchants/{id}`

### `src/app/pages/cards/PTSPs.jsx`
- `GET /cards/ptsps`
- `GET /cards/ptsps/get/actions`
- `GET /cards/ptsps/institution/{institution}`
- `GET /cards/ptsps/merchant/{merchant}`
- `GET /cards/ptsps/q/search`
- `PUT /cards/ptsps`
- `PUT /cards/ptsps/{ptsp_id}`
- `PUT /cards/ptsps/{type}/{id}`
- `PUT /cards/ptsps/reject/{type}/{id}`
- `DELETE /cards/ptsps/{id}`

### `src/app/pages/cards/CardFIs.jsx`
- `GET /cards/financial-institutions`
- `GET /cards/financial-institutions/get/actions`
- `GET /cards/financial-institutions/merchant/{merchant}`
- `GET /cards/financial-institutions/q/search`
- `PUT /cards/financial-institutions`
- `PUT /cards/financial-institutions/{id}`
- `PUT /cards/financial-institutions/{type}/{id}`
- `PUT /cards/financial-institutions/reject/{type}/{id}`
- `DELETE /cards/financial-institutions/{id}`

## Card Payment Screens

### `src/app/pages/cards/WebPayments.jsx`
- `GET /cardpayments/{institutioncode}`
- Possible fallback if richer transaction listing is required:
  - `GET /cards/transactions`
  - `GET /cards/transactions/q/search`

### `src/app/pages/cards/NUSPayments.jsx`
- `GET /nuspayments/{institutioncode}`

### `src/app/pages/cards/GAPSPayments.jsx`
- `GET /gapspayments`

## Card Disputes

### `src/app/pages/cards/CardDisputeList.jsx`
- `GET /cards/transactions/disputes`
- `GET /cards/transactions/disputes/{uniqueid}`
- `GET /cards/transactions/disputes/institution/{institutioncode}`
- `GET /cards/transactions/disputes/merchant/{merchantid}`
- `GET /cards/transactions/disputes/q/search`
- `GET /cards/transactions/arbitrated-disputes/institution/{institutioncode}`
- `POST /cards/transactions/disputes/approve`
- `POST /cards/transactions/disputes/approve_reject_bulk`
- `PUT /cards/transactions/disputes/create`
- `PUT /cards/transactions/disputes/create/bulk`
- `PUT /cards/transactions/disputes/create/bulk-1`
- `PUT /cards/transactions/disputes/log`

## Card Settlements

### `src/app/pages/cards/CardSettlements.jsx`
- `GET /cards/settlements`
- `GET /cards/settlements/acq/{acq}`
- `GET /cards/settlements/iss/{iss}`
- `GET /cards/settlements/merchant/{merchant}`
- `GET /cards/settlements/ptsp/{ptsp}`

## Likely Unused Swagger Endpoints By Current UI

These endpoints exist in Swagger, but there is no obvious current frontend screen consuming them yet:

- `GET /app/crons/*`
- `GET /cards/banks`
- `GET /cards/states`
- `GET /cards/skr`
- `GET /cards/tnxdirection`
- `GET /cards/terminal-types`
- `GET /other-users/get`
- `GET /other-users/get/actions`
- `GET /roles/get`
- `GET /transactions-rates`
- `GET /transactions-rates/institution/{institutioncode}`
- `GET /transactions-rates/inward`
- `GET /transactions-rates/inward/institution/{institutioncode}`

## Integration Priority

If you want to connect the frontend in phases, this is the recommended order:

1. Authentication
2. Dashboards and analytics
3. Transactions
4. Wallets
5. Approvals
6. Settlements
7. Card master data
8. Card disputes
9. Card settlements

## Known Gaps

- Activation token validation is not clearly represented in the Swagger spec.
- The TSQ Retry screen does not have a clearly matching endpoint in the current Swagger spec.
- Some screen behavior may require combining multiple list/detail/search endpoints depending on backend response shapes.
