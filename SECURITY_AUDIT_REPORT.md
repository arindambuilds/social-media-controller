# Security audit report — social-media-controller (pre-launch)

**Scope:** Express API (`src/`), Prisma, Next.js dashboard (`dashboard/`), config, dependencies.  
**Date:** 2026-03-28  
**Path mapping:** Deliverables referenced `apps/api/src/*`; this repo’s API lives at repository root **`src/`** (Render/tsc build). Implementations: `src/config/env.ts`, `src/middleware/rateLimiter.ts`, `src/middleware/errorHandler.ts`.

---

## Git history check (operator)

Run locally to detect committed secrets:

```bash
git log --all --full-history -- .env
git log --all --full-history -- .env.local
git log --all --full-history -- dashboard/.env.production
```

---

## Findings summary

| ID | Severity | Location | Issue | Status / fix |
|----|-----------|----------|-------|----------------|
| SEC-001 | **HIGH** | `src/config/env.ts` L31–32 | Default `JWT_EXPIRES_IN` was `1d` — access tokens far exceed 15-minute production guideline. | Default `15m`; production super-refine caps access/refresh. |
| SEC-002 | **HIGH** | `src/config/env.ts` L51 | Default `CORS_ORIGIN=*` allows any browser origin in production if env unset. | Refuse `*` when `NODE_ENV=production`. |
| SEC-003 | **HIGH** | `src/app.ts` L99–110 | Auth rate limit 60/15m for login/signup/refresh — weaker than policy (login 5/15m, register 3/h). | Per-route limiters in `rateLimiter.ts` + auth router. |
| SEC-004 | **HIGH** | `src/app.ts` L81–88 | `GET /` registered **before** `helmet()` — first middleware chain not fully hardened. | Apply `helmet` + CORS + limits before public routes (except skip paths). |
| SEC-005 | **HIGH** | `src/app.ts` L163–172 | `/api/health/db` returned Prisma `detail` to client — DB host/leaks. | Generic error body in production. |
| SEC-006 | **HIGH** | `src/app.ts` L155–159 | `/api/health` with `deps=1` could expose dependency error messages. | Sanitize production payload. |
| SEC-007 | **MEDIUM** | `src/auth/jwt.ts` L12–28 | JWT sign/verify did not pin `algorithm` — defense-in-depth for alg confusion. | Explicit **HS256** on sign and verify. |
| SEC-008 | **MEDIUM** | `src/middleware/errorHandler.ts` L6–12 | Always `500` + generic body; no Zod centralization; production should never echo internal `message` for unknown errors. | Zod/Prisma-aware handler; safe production responses. |
| SEC-009 | **MEDIUM** | `src/app.ts` L89 | `helmet()` defaults only — audit requested explicit CSP / Referrer-Policy / HSTS behavior. | Custom Helmet config for API. |
| SEC-010 | **MEDIUM** | `src/app.ts` L91–95 | CORS `methods` not restricted (wildcard behavior). | Whitelist `GET,POST,PUT,PATCH,DELETE,OPTIONS` (+ `HEAD` implicit for some stacks). |
| SEC-011 | **LOW** | `dashboard/lib/auth-storage.ts` | JWT in **localStorage** — XSS can steal tokens. | Document risk + recommend httpOnly cookies. |
| SEC-012 | **LOW** | `dashboard/app/login/page.tsx` L15 | Default password pre-filled (`Demo1234!`) — UX leak in shared screens. | **Not changed** (demo product); noted as demo-only risk. |
| SEC-013 | **LOW** | `.env.example` L18–20 | Placeholder text said JWT min 16 chars while schema requires 32. | Aligned comments + `15m` access example. |
| SEC-014 | **INFO** | `docker-compose.yml` L6–7 | `POSTGRES_PASSWORD=postgres` — **dev-only**; acceptable for local compose. | Documented; not production. |
| SEC-015 | **INFO** | `DEPLOYMENT.md` / `docs/local-dev.md` | Example `postgresql://` strings — placeholders, not live secrets. | No change. |
| SEC-016 | **INFO** | No `forgot-password` route | Rate limit for `POST /api/auth/forgot-password` N/A. | — |
| SEC-017 | **INFO** | Prisma raw SQL | Only tagged `$queryRaw\`...\`` in `src/app.ts` L166, `src/lib/healthCheck.ts` L21 — **safe** (parameterized). | No change. |
| SEC-018 | **INFO** | Supabase RLS | App uses **Prisma** `DATABASE_URL` (server-side). RLS applies to PostgREST/anon keys, not this path. | Document: lock down DB role + network; optional RLS for direct Supabase access. |
| SEC-019 | **INFO** | `package.json` / `npm audit` | **HIGH:** transitive `effect` (via Prisma), `tar` (via `bcrypt` → `@mapbox/node-pre-gyp`). | **`overrides`** to patched `effect` + `tar` (verify `npm install` / build). |
| SEC-020 | **MEDIUM** | `.gitignore` | `.env.production` under `dashboard/` not explicitly ignored. | Added `dashboard/.env.production`, `.env.*` with `!.env.example` exception. |

### Pass / no issue

- **Passwords:** `src/services/authService.ts` — bcrypt cost **12** (≥10); no plaintext compare; `passwordHash` stripped in `src/routes/auth.ts` L164.
- **Secrets in repo scan:** No hardcoded `JWT_SECRET` / live `DATABASE_URL` in tracked `src/` or `dashboard/` sources (local `.env` must stay untracked — operator responsibility).
- **NEXT_PUBLIC_:** Dashboard only exposes `NEXT_PUBLIC_API_URL` and redirect URIs — no API secrets (see `dashboard/lib/api.ts` L7–15).
- **dangerouslySetInnerHTML:** None in `dashboard/`.

---

## Dependency remediation (npm audit — HIGH)

| Package | Via | Action |
|---------|-----|--------|
| `effect` <3.20.0 | `prisma` → `@prisma/config` | `overrides` → `effect@^3.20.3` |
| `tar` ≤7.5.10 | `bcrypt` → `@mapbox/node-pre-gyp` | `overrides` → `tar@^7.5.11` |

After overrides: run `npm install`, `npm audit --audit-level=high`, `npm run build`, `npm test`.

**Result (2026-03-28):** `npm audit --audit-level=high` reports **0** vulnerabilities after `overrides` for `effect` and `tar`.

---

## Residual / operational

- **Pooler / SSL:** Production `DATABASE_URL` should use Supabase pooler (`:6543`) + `?sslmode=require` where applicable — enforce in ops, optional future env validation.
- **Sentry / logs:** Ensure PII/passwords never attached as Sentry breadcrumbs (review manual `captureException` call sites periodically).
