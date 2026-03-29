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
import { fetchMe } from "../lib/api";
import {
  AUTH_STORAGE_SYNC_EVENT,
  clearAuthStorage,
  CLIENT_ID_KEY,
  notifyAuthStorageSync,
  REFRESH_TOKEN_KEY,
  TOKEN_KEY
} from "../lib/auth-storage";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  clientId: string | null;
};

export type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  user: AuthUser | null;
  userLoading: boolean;
  setSession: (accessToken: string, clientId?: string | null, refreshToken?: string | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setIsReady(true);
  }, []);

  useEffect(() => {
    const onSync = () => {
      setToken(localStorage.getItem(TOKEN_KEY));
    };
    window.addEventListener(AUTH_STORAGE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(AUTH_STORAGE_SYNC_EVENT, onSync);
  }, []);

  /** Other tabs: keep session in sync when localStorage auth keys change. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key === TOKEN_KEY || e.key === REFRESH_TOKEN_KEY || e.key === CLIENT_ID_KEY) {
        setToken(localStorage.getItem(TOKEN_KEY));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!isReady || !token) {
      setUser(null);
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    setUserLoading(true);
    fetchMe()
      .then((m) => {
        if (!cancelled) setUser(m.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setUserLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, token]);

  const setSession = useCallback((accessToken: string, clientId?: string | null, refreshToken?: string | null) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken !== undefined) {
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      else localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    if (clientId !== undefined) {
      if (clientId) localStorage.setItem(CLIENT_ID_KEY, clientId);
      else localStorage.removeItem(CLIENT_ID_KEY);
    }
    setToken(accessToken);
    notifyAuthStorageSync();
  }, []);

  const clearSession = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, isReady, user, userLoading, setSession, clearSession }),
    [token, isReady, user, userLoading, setSession, clearSession]
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
