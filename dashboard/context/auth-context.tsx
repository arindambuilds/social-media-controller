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
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/auth-storage";
import {
  authLogoutFireAndForget,
  fetchMe,
  notifyAccessTokenChanged,
  restoreSessionFromRefresh,
  subscribeAccessToken
} from "../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  clientId: string | null;
  plan?: string | null;
  onboardingCompleted?: boolean;
};

export type AuthContextValue = {
  token: string | null;
  isReady: boolean;
  user: AuthUser | null;
  userLoading: boolean;
  setSession: (accessToken: string) => void;
  clearSession: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  const syncFromMemory = useCallback(() => {
    setToken(getAccessToken());
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getAccessToken();
    if (!currentToken) {
      setUser(null);
      return;
    }
    setUserLoading(true);
    try {
      const me = await fetchMe(currentToken);
      const nextUser: AuthUser = {
        ...me.user,
        plan: me.user.plan ?? me.plan ?? null,
        clientId: me.user.clientId ?? null
      };
      setUser(nextUser);
    } catch {
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      await restoreSessionFromRefresh();
      if (cancelled) return;
      const t = getAccessToken();
      setToken(t);
      if (t) {
        await refreshUser();
      } else {
        setUser(null);
      }
      if (!cancelled) setIsReady(true);
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    const unsub = subscribeAccessToken(syncFromMemory);
    syncFromMemory();
    return unsub;
  }, [syncFromMemory]);

  const setSession = useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    setToken(accessToken);
    notifyAccessTokenChanged();
  }, []);

  const clearSession = useCallback(() => {
    clearAccessToken();
    notifyAccessTokenChanged();
    authLogoutFireAndForget();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, isReady, user, userLoading, setSession, clearSession, refreshUser }),
    [token, isReady, user, userLoading, setSession, clearSession, refreshUser]
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
