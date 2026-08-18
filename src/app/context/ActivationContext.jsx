"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ActivationContext = createContext(undefined);

export function ActivationProvider({ children }) {
  const [tokenStatus, setTokenStatus] = useState(null);
  const [tokenMessage, setTokenMessage] = useState("");
  const [activationToken, setActivationToken] = useState("");
  const [user, setUserState] = useState(null);
  const [credentialsSet, setCredentialsSet] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  const setValidationResult = useCallback((status, message = "", userData = null, token = "") => {
    setTokenStatus(status);
    setTokenMessage(message);
    setActivationToken(token);
    if (userData) setUserState(userData);
  }, []);

  const markCredentialsSet = useCallback(() => setCredentialsSet(true), []);
  const markMfaVerified = useCallback(() => setMfaVerified(true), []);

  const reset = useCallback(() => {
    setTokenStatus(null);
    setTokenMessage("");
    setActivationToken("");
    setUserState(null);
    setCredentialsSet(false);
    setMfaVerified(false);
  }, []);

  const value = {
    tokenStatus,
    tokenMessage,
    activationToken,
    user,
    credentialsSet,
    mfaVerified,
    setValidationResult,
    markCredentialsSet,
    markMfaVerified,
    reset,
  };

  return (
    <ActivationContext.Provider value={value}>
      {children}
    </ActivationContext.Provider>
  );
}

export function useActivation() {
  const ctx = useContext(ActivationContext);
  if (ctx === undefined) throw new Error("useActivation must be used within ActivationProvider");
  return ctx;
}
