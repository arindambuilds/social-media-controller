"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { CLIENT_ID_KEY, TOKEN_KEY } from "../lib/auth-storage";

export type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  setSession: (accessToken: string, clientId?: string | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setIsReady(true);
  }, []);

  const setSession = useCallback((accessToken: string, clientId?: string | null) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (clientId) {
      localStorage.setItem(CLIENT_ID_KEY, clientId);
    } else {
      localStorage.removeItem(CLIENT_ID_KEY);
    }
    setToken(accessToken);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_ID_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ token, isReady, setSession, clearSession }),
    [token, isReady, setSession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
