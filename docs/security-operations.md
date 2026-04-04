# PulseOS Security Operations

## Vitest baseline

The API test suite size is tracked as the current `npx vitest run` total (see CI and `package.json`). An older **“81 tests”** figure in planning docs was **stale**; the repo baseline is **not** tied to the security PRs — tests were added over time for features (WhatsApp, briefings, PDF, etc.). Before production deploys, run:

```bash
npx vitest run --reporter=verbose
```

and confirm failures are real regressions, not environment (DB/Redis) issues.

## CORS wildcard in production (two layers)

| Mechanism | When it runs |
|-----------|----------------|
| **`src/config/corsGuard.ts`** | First side-effect import in `src/app.ts` (`import "./config/corsGuard"`). In the **normal API** process, `server.ts` imports `createApp` from `./app` **before** `./config/env`, so `corsGuard` executes **before** `env.ts` Zod parsing. |
| **`src/config/env.ts` (Zod `superRefine`)** | Any entry point that imports `./config/env` (scripts, tests, workers) still gets validation: `CORS_ORIGIN=*` with `NODE_ENV=production` fails parse. |

If both run, `corsGuard` may throw first with the `[SECURITY]` message; if only `env` loads, Zod fails instead. **Both outcomes are safe** (process does not start with wildcard CORS in production). Document whichever path your operators hit when triaging misconfiguration.

## Secret Rotation Procedure

### JWT_SECRET

1. Generate new secret: `openssl rand -base64 48`
2. Set new value in Render environment variables.
3. Trigger a rolling restart (Render does this automatically on env var save).
4. All existing JWTs signed with the old secret will immediately be invalid.
   Users will be prompted to log in again — this is expected and acceptable.
5. Confirm `/api/auth/refresh` returns 401 for tokens issued before rotation.

### ENCRYPTION_KEY (AES-256-GCM)

1. Generate new key: `openssl rand -hex 32`
2. **Before rotating:** Export any data encrypted with the current key if
   long-term retention is required (re-encrypt after rotation).
3. **During migration (recommended):** Keep the previous key in a **secondary** variable, e.g. `ENCRYPTION_KEY_PREV`, while application code can still decrypt historical records. Use `npm run security:reencrypt:social-accounts -- --write` to rotate persisted `SocialAccount` ciphertext onto the primary key before removing the old key.
4. Set the new `ENCRYPTION_KEY` in Render environment variables.
5. Trigger rolling restart.
6. After confirming no decrypt errors in logs and all critical rows migrated, **remove `ENCRYPTION_KEY_PREV`** and redeploy.
7. Data encrypted only with the old key will fail to decrypt after the old material is gone — plan cutover accordingly.

## CORS_ORIGIN

- Must never be `*` in production (enforced at startup — see `src/config/corsGuard.ts` and `src/config/env.ts`).
- Valid example: `https://app.pulseos.io`
- To allow multiple origins, implement an allowlist array in `corsOptions` (`src/config/cors.ts`).

## Rate Limit Redis Keys

- Auth limiter keys: `rl:auth:*` (TTL: 15 min)
- API limiter keys: `rl:global:*` (TTL: 15 min for the global limiter window)
- Other prefixes: `rl:refresh:`, `rl:register:`, `rl:tenant:`, `rl:dm_preview:`, `rl:report_pdf:`, `rl:webhook:`
- To manually clear a blocked IP for login: `redis-cli --scan --pattern 'rl:auth:*'` then `redis-cli del <key>`
- When `REDIS_URL` is unset, limiters fall back to in-memory stores (per process only).

## PDF rendering (XSS / SSRF notes)

- **DOMPurify** (`src/utils/sanitize.ts`) strips dangerous tags/attributes on **user-derived** strings embedded in report HTML. Full-document sanitization is **not** applied (would break chart images and layout).
- **Puppeteer** (`PdfService`): Chromium is launched **without** `--disable-web-security`. Inline `<style>` / CSS `url()` SSRF is mitigated by forbidding untrusted `<style>` in sanitize and using controlled templates; chart images use **`https://quickchart.io/`** from server-generated config.
- **Agency logos** render as `<img src="...">` with URLs from stored settings, but `logoUrl` is now validated on save and re-checked during report HTML build. Only safe `/uploads/logos/...` paths or public `https://...` URLs are accepted; localhost, metadata endpoints, and RFC1918/private ranges are rejected.
- **Gotenberg** path (`GOTENBERG_URL`): HTML is POSTed to your Gotenberg service; harden that service separately (network policy, trusted input).
