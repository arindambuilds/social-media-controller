# Pilot & government-facing operational readiness (evidence-based)

This doc aligns **external narrative** with **what the repository actually implements**. Update it when architecture or deploy posture changes.

## What the codebase proves today

| Claim | Evidence in repo |
|--------|------------------|
| Official Instagram / Meta path | OAuth + Graph-oriented services (`src/services/instagramOAuthService.ts`, `instagramIngestionService.ts`, `INGESTION_MODE=mock` for demo-safe path). **Not** a scraper stack. |
| Tenant scoping for `clientId` routes | `resolveTenant` / `resolveTenantFromBody` on analytics + AI; `canAccessClient` on posts; leads list forces `CLIENT_USER` to `req.auth.clientId`; lead PATCH checks ownership. **AGENCY_ADMIN** is intentionally cross-tenant. |
| Security baseline | `SECURITY_AUDIT_REPORT.md`, `src/config/env.ts` (production CORS/JWT/DB-TLS rules), `src/middleware/rateLimiter.ts`, `src/middleware/errorHandler.ts`, Helmet/CSP in `src/app.ts`. |
| Jobs | BullMQ workers exist; **without `REDIS_URL`** jobs can run **inline** in API — fine for tiny pilots, **not** a scale posture. |

## Critical deploy facts (often underestimated)

1. **OAuth `state`:** Without Redis, `oauthStateStore` falls back to **process memory** → **broken with multiple API instances** or restarts. Production pilot should set **`REDIS_URL`** (e.g. Upstash).  
2. **Render + Supabase:** `DATABASE_URL` must match the DB you seeded; **`sslmode=require`** required in production per env validator.  
3. **JWT in localStorage (dashboard):** Works for MVP; **XSS = token theft**. Government / scale pilots should plan **httpOnly cookies** as a phase-2 item.

## Government / MSME proposal discipline

- Use language from **`docs/incubation-readiness.md`**: pilot, assistant, decision support — **no** guaranteed ROI or invented DAU.  
- **500 MSMEs** is a **target**, not a shipped metric, until onboarding records exist.  
- **5T / Digital Odisha / Startup Odisha** alignment should be framed as **digitisation of marketing decisions** + **local pilot depth**, with **measurable pilot KPIs** (logins/week, accounts connected, qualitative quotes with consent).

## Honest maturity label

See CTO audit in project discussions: treat as **MVP release candidate** for **controlled demos and small pilots**, not as **district-scale production** without Redis-backed jobs, stable multi-instance OAuth, and proven Render/DB uptime.
