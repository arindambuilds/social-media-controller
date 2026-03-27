# Implementation roadmap (Instagram-first)

Aligned with **Instagram growth copilot** positioning — not a generic multi-network suite.

## Phase 1 — Pilot-ready core (now)

- PostgreSQL + Redis + API + workers running reliably on Windows dev machines  
- Prisma migrations + seed with **believable local-business demo data**  
- Auth: signup / login / refresh + dashboard session  
- Instagram OAuth + ingestion: **`INGESTION_MODE=mock`** for demos; **instagram** when Meta is configured  
- Dashboard: analytics, insights, onboarding, captions  

## Phase 2 — Production hardening

- Scheduled ingestion + token refresh reliability  
- Stronger tenant isolation audits on all `clientId` routes  
- Observability (Sentry, basic queue health)  
- Lead detection improvements (optional NLP) — **only if pilots ask**  

## Phase 3 — Scale & monetisation

- Billing integration (subscription) when pilots convert  
- Exports / reports for agencies  
- White-label only if enterprise pull exists  

**Explicitly deferred:** building parity features for every social network before Instagram is excellent.
