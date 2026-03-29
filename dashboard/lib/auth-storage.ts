/**
 * SECURITY: Tokens in localStorage are readable by any XSS payload on this origin.
 * Prefer httpOnly + Secure + SameSite=strict cookies for production hardening.
 */
export const TOKEN_KEY = "smc_token";
export const REFRESH_TOKEN_KEY = "smc_refresh_token";
export const CLIENT_ID_KEY = "smc_client_id";

/** Dispatched when access/refresh tokens in localStorage change (e.g. silent refresh). */
export const AUTH_STORAGE_SYNC_EVENT = "smc-auth-storage-sync";

export function notifyAuthStorageSync(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_STORAGE_SYNC_EVENT));
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredClientId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLIENT_ID_KEY);
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(CLIENT_ID_KEY);
}

export function setStoredClientId(clientId: string | null): void {
  if (clientId) {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  } else {
    localStorage.removeItem(CLIENT_ID_KEY);
  }
}
