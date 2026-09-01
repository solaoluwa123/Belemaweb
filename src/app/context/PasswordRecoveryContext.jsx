"use client";

import { createContext, useContext, useState, useCallback } from "react";

const PasswordRecoveryContext = createContext(undefined);

const TOKEN_STATUS = {
  IDLE: "idle",
  VALIDATING: "validating",
  VALID: "valid",
  INVALID: "invalid",
  EXPIRED: "expired",
  LOCKED: "locked",
};

export function PasswordRecoveryProvider({ children }) {
  const [email, setEmailState] = useState("");
  /** Six-character reference from reset link; sent as username on POST /users/resetpassword. */
  const [recoveryRef, setRecoveryRef] = useState("");
  /** Raw token from reset link (query or email flow); sent with POST /users/resetpassword. */
  const [recoveryToken, setRecoveryToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState(TOKEN_STATUS.IDLE);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  const setEmail = useCallback((value) => {
    setEmailState(value ?? "");
  }, []);

  const startValidation = useCallback(() => {
    setTokenStatus(TOKEN_STATUS.VALIDATING);
  }, []);

  const markTokenValid = useCallback(() => {
    setTokenStatus(TOKEN_STATUS.VALID);
  }, []);

  const markTokenInvalid = useCallback(() => {
    setTokenStatus(TOKEN_STATUS.INVALID);
  }, []);

  const markTokenExpired = useCallback(() => {
    setTokenStatus(TOKEN_STATUS.EXPIRED);
  }, []);

  const markLocked = useCallback(() => {
    setTokenStatus(TOKEN_STATUS.LOCKED);
    setIsLocked(true);
  }, []);

  const markMfaVerified = useCallback(() => {
    setMfaVerified(true);
  }, []);

  const markResetComplete = useCallback(() => {
    setResetComplete(true);
  }, []);

  const requireForcePasswordChange = useCallback(() => {
    setForcePasswordChange(true);
  }, []);

  const clearForcePasswordChange = useCallback(() => {
    setForcePasswordChange(false);
  }, []);

  const resetFlow = useCallback(() => {
    setEmailState("");
    setRecoveryRef("");
    setRecoveryToken("");
    setTokenStatus(TOKEN_STATUS.IDLE);
    setMfaVerified(false);
    setResetComplete(false);
    setIsLocked(false);
  }, []);

  const value = {
    email,
    setEmail,
    recoveryRef,
    setRecoveryRef,
    recoveryToken,
    setRecoveryToken,
    tokenStatus: tokenStatus,
    TOKEN_STATUS,
    startValidation,
    markTokenValid,
    markTokenInvalid,
    markTokenExpired,
    markLocked,
    mfaVerified,
    markMfaVerified,
    resetComplete,
    markResetComplete,
    isLocked,
    forcePasswordChange,
    requireForcePasswordChange,
    clearForcePasswordChange,
    resetFlow,
  };

  return (
    <PasswordRecoveryContext.Provider value={value}>
      {children}
    </PasswordRecoveryContext.Provider>
  );
}

export function usePasswordRecovery() {
  const context = useContext(PasswordRecoveryContext);
  if (context === undefined) {
    throw new Error("usePasswordRecovery must be used within PasswordRecoveryProvider");
  }
  return context;
}
