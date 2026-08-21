import { createBrowserRouter, Navigate } from "react-router";

import Login from "./pages/auth/Login";
import TwoFactorAuth from "./pages/auth/TwoFactorAuth";
import ActivationLayout from "./pages/auth/activation/ActivationLayout";
import {
  ActivationRequestPage,
  TokenProcessingPage,
  IdentityConfirmationPage,
  CredentialSetupPage,
  MfaSetupPage,
  ActivationSuccessPage,
} from "./pages/auth/activation";
import PasswordRecoveryLayout from "./pages/auth/password-recovery/PasswordRecoveryLayout";
import {
  ForgotPasswordPage,
  EmailSentPage,
  TokenValidationPage,
  MfaVerificationPage,
  ResetPasswordPage,
  ResetSuccessPage,
  ExpiredInvalidLinkPage,
  AccountLockedPage,
} from "./pages/auth/password-recovery";
import ForcedPasswordChangePage from "./pages/auth/password-recovery/ForcedPasswordChangePage";
import Forced2FASetupPage from "./pages/auth/password-recovery/Forced2FASetupPage";
import SecuritySettings from "./pages/settings/SecuritySettings";

import TransgateDashboard from "./pages/dashboards/TransgateDashboard";
import StatisticsPage from "./pages/dashboards/statistics/StatisticsPage";
import SuccessfulTransactionsPage from "./pages/dashboards/statistics/SuccessfulTransactionsPage";
import AverageTimePage from "./pages/dashboards/statistics/AverageTimePage";
import FailedCodesPage from "./pages/dashboards/statistics/FailedCodesPage";
import ByChannelPage from "./pages/dashboards/statistics/ByChannelPage";
import ByInstitutionPage from "./pages/dashboards/statistics/ByInstitutionPage";
import InstitutionDetailPage from "./pages/dashboards/statistics/InstitutionDetailPage";

import TransactionList from "./pages/transactions/TransactionList";
import TransactionDetails from "./pages/transactions/TransactionDetails";
import TransactionStatusChange from "./pages/transactions/TransactionStatusChange";

function TransactionsIndexRedirect() {
  return <Navigate to="/transactions" replace />;
}

import LogDispute from "./pages/disputes/LogDispute";
import DisputesList from "./pages/disputes/DisputesList";
import ArbitratedDisputes from "./pages/disputes/ArbitratedDisputes";

import WalletList from "./pages/wallets/WalletList";
import WalletActivity from "./pages/wallets/WalletActivity";
import WalletActivitiesAll from "./pages/wallets/WalletActivitiesAll";
import InstitutionWalletActivity from "./pages/wallets/InstitutionWalletActivity";
import FundWallet from "./pages/wallets/FundWallet";
import FundWalletReview from "./pages/wallets/FundWalletReview";
import CreateWallet from "./pages/wallets/CreateWallet";
import PendingUserApprovals from "./pages/approvals/PendingUserApprovals";
import WalletApprovals from "./pages/approvals/WalletApprovals";
import InstitutionApprovals from "./pages/approvals/InstitutionApprovals";
import UsersManagement from "./pages/admin/UsersManagement";
import OtherUsers from "./pages/admin/OtherUsers";
import FinancialInstitutions from "./pages/admin/FinancialInstitutions";
import InstitutionContacts from "./pages/admin/InstitutionContacts";
import AuditLogs from "./pages/admin/AuditLogs";

import AppLayout from "./components/layout/AppLayout";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter(
  [
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/2fa",
    Component: TwoFactorAuth,
  },
  {
    path: "/password-recovery",
    Component: PasswordRecoveryLayout,
    children: [
      { index: true, Component: ForgotPasswordPage },
      { path: "sent", Component: EmailSentPage },
      { path: "verify", Component: TokenValidationPage },
      { path: "mfa", Component: MfaVerificationPage },
      { path: "reset", Component: ResetPasswordPage },
      { path: "success", Component: ResetSuccessPage },
      { path: "expired", Component: ExpiredInvalidLinkPage },
      { path: "locked", Component: AccountLockedPage },
    ],
  },
  {
    path: "/auth/force-password-change",
    Component: ForcedPasswordChangePage,
  },
  {
    path: "/auth/force-2fa-setup",
    Component: Forced2FASetupPage,
  },
  {
    path: "/activate",
    Component: ActivationLayout,
    children: [
      { index: true, Component: ActivationRequestPage },
      { path: "verify", Component: TokenProcessingPage },
      { path: "confirm", Component: IdentityConfirmationPage },
      { path: "credentials", Component: CredentialSetupPage },
      { path: "mfa", Component: MfaSetupPage },
      { path: "success", Component: ActivationSuccessPage },
    ],
  },
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate to="/transactions" replace /> },
      { path: "dashboard", element: <Navigate to="/dashboard/accounts" replace /> },
      { path: "dashboard/accounts", Component: TransgateDashboard },
      { path: "dashboard/transgate", element: <Navigate to="/dashboard/accounts" replace /> },
      { path: "dashboard/live-monitoring", element: <Navigate to="/transactions" replace /> },
      { path: "dashboard/statistics", Component: StatisticsPage },
      { path: "dashboard/statistics/successful-transactions", Component: SuccessfulTransactionsPage },
      { path: "dashboard/statistics/average-time", Component: AverageTimePage },
      { path: "dashboard/statistics/failed-codes", Component: FailedCodesPage },
      { path: "dashboard/statistics/by-channel", Component: ByChannelPage },
      { path: "dashboard/statistics/by-institution", Component: ByInstitutionPage },
      { path: "dashboard/statistics/institution/:institutionName", Component: InstitutionDetailPage },

      { path: "transactions", Component: TransactionList },
      { path: "settings/security", Component: SecuritySettings },
      { path: "transactions/live", Component: TransactionsIndexRedirect },
      { path: "transactions/status-change", Component: TransactionStatusChange },
      { path: "transactions/:id", Component: TransactionDetails },

      { path: "disputes/log", Component: LogDispute },
      { path: "disputes/arbitrated", Component: ArbitratedDisputes },
      { path: "disputes", Component: DisputesList },

      { path: "wallets/activities", Component: WalletActivitiesAll },
      { path: "wallets/institution-activity", Component: InstitutionWalletActivity },
      { path: "wallets/fund/review/:requestId", Component: FundWalletReview },
      { path: "wallets/fund", Component: FundWallet },
      { path: "wallets/create", Component: CreateWallet },
      { path: "wallets", Component: WalletList },
      { path: "wallets/:id/activity", Component: WalletActivity },

      { path: "approvals/change-requests", element: <Navigate to="/approvals/wallets" replace /> },
      { path: "approvals/users", Component: PendingUserApprovals },
      { path: "approvals/wallets", Component: WalletApprovals },
      { path: "approvals/institutions", Component: InstitutionApprovals },
      { path: "approvals/transactions-accounts", element: <Navigate to="/transactions/status-change" replace /> },

      { path: "admin/users", Component: UsersManagement },
      { path: "admin/other-users", Component: OtherUsers },
      { path: "admin/institutions", Component: FinancialInstitutions },
      { path: "admin/institutions/:institutionId/contacts", Component: InstitutionContacts },
      { path: "admin/audit-logs", Component: AuditLogs },

      { path: "*", Component: NotFound },
    ],
  },
  ],
  {
    basename: String(import.meta.env.BASE_URL || "/")
      .replace(/\/$/, "") || "/",
  },
);
