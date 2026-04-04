# PulseOS Security Operations

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
3. Update `ENCRYPTION_KEY` in Render environment variables.
4. Trigger rolling restart.
5. Data encrypted with the old key will fail to decrypt — ensure any
   persistent encrypted fields are migrated or re-encrypted before cutover.

## CORS_ORIGIN

- Must never be `*` in production (enforced at startup — see `src/config/corsGuard.ts` and `src/config/env.ts`).
- Valid example: `https://app.pulseos.io`
- To allow multiple origins, implement an allowlist array in `corsOptions` (`src/config/cors.ts`).

## Rate Limit Redis Keys

- Auth limiter keys: `rl:auth:*` (TTL: 15 min)
- API limiter keys: `rl:global:*` (TTL: 15 min for the global limiter window)
- Other prefixes: `rl:refresh:`, `rl:register:`, `rl:dm_preview:`, `rl:report_pdf:`, `rl:webhook:`
- To manually clear a blocked IP for login: `redis-cli --scan --pattern 'rl:auth:*'` then `redis-cli del <key>`
- When `REDIS_URL` is unset, limiters fall back to in-memory stores (per process only).
