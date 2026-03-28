# API package path (security audit mapping)

The Express API is built from **`src/` at the repository root** (see root `package.json` `main` / `tsc`).

Security deliverables referenced as `apps/api/src/...` map as follows:

| Audit path | Actual path |
|------------|-------------|
| `apps/api/src/config/env.ts` | `src/config/env.ts` |
| `apps/api/src/middleware/rateLimiter.ts` | `src/middleware/rateLimiter.ts` |
| `apps/api/src/middleware/errorHandler.ts` | `src/middleware/errorHandler.ts` |
