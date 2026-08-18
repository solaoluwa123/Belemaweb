"use client";

import { Outlet } from "react-router";
import { PasswordRecoveryProvider } from "../../../context/PasswordRecoveryContext";

/**
 * Wraps all /password-recovery/* routes with PasswordRecoveryProvider
 * so flow state (email, token status, MFA, etc.) is available.
 */
export default function PasswordRecoveryLayout() {
  return (
    <PasswordRecoveryProvider>
      <Outlet />
    </PasswordRecoveryProvider>
  );
}
