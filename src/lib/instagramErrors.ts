/** Instagram-specific error classes for proper error handling and classification. */

export class InstagramAuthError extends Error {
  constructor(message: string, public socialAccountId: string) {
    super(message);
    this.name = "InstagramAuthError";
  }
}

/** Check if an error indicates Instagram authentication failure (401/403 responses). */
export function isInstagramAuthError(err: unknown): err is InstagramAuthError {
  if (err instanceof InstagramAuthError) return true;

  const msg = err instanceof Error ? err.message : String(err);
  // Check for HTTP 401/403 status codes or auth-related error messages
  return /(401|403|unauthorized|forbidden|invalid access token|access token has expired|token.*invalid|token.*expired)/i.test(msg);
}