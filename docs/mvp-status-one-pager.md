# MVP status — one-pager (investors, mentors, pilots)

**PDF:** [`mvp-status-one-pager.pdf`](./mvp-status-one-pager.pdf) — regenerate with `npm run pdf:mvp-one-pager` (renders via Microsoft Edge; no extra Chromium download).

*Source docs: `mvp-product.md`, `launch-checklist.md`, `implementation-roadmap.md`, `2-week-plan.md`, `incubation-readiness.md`.*

---

## Executive summary

**Product:** Instagram-first growth copilot for local businesses and creators (India / Odisha pilot framing) — connect account (or mock path), analytics, AI insights, captions, leads, dashboard.

**Engineering posture:** **MVP release candidate** — scope frozen except fixes needed for demos and pilots. Local demo path: migrate → seed → API + worker + dashboard → `npm run smoke:demo` green.

**Honest stage:** Pilot / early evidence — not scaled SaaS. Use **pilot** language; do not invent DAU, revenue, or customer logos without proof.

---

## What “done” means for this MVP

Aligned with **`docs/launch-checklist.md`** (freeze boundary):

- Auth (signup / login / refresh / `me`), JWT, dashboard session + `clientId` context.  
- Seeded demo: Urban Glow Studio (`demo-client`), dual primary logins + optional agency presentation user (see **`docs/launch-checklist.md`** table).  
- Analytics (overview, charts, top posts from seeded data).  
- AI: content-performance insight, weekly focus, captions (OpenAI optional).  
- Leads: list + status patch.  
- Onboarding / OAuth authorise URL; **`INGESTION_MODE=mock`** for demos without Meta.

---

## Investor / mentor talking points (credible)

| Topic | Say this |
|--------|----------|
| Problem | Owners lack time to read IG Insights or decide what to post next. |
| Solution | Decision support: clearer performance signals + suggested next steps + caption help. |
| Scope | Instagram-first; not an all-network scheduler or ads product. |
| Tech proof | API + dashboard + jobs; mock ingestion when Meta isn’t configured. |
| Traction | Pilots and qualitative feedback — count real businesses with consent, not vanity metrics. |

---

## 1. Explicitly out of scope for this MVP (not “incomplete MVP”)

From **`launch-checklist.md`** / **`mvp-product.md`**:

- Multi-platform publishing, ads, enterprise SSO, mobile apps.  
- Full billing / payments (checklist allows **usage counter only**).  
- Heavy “production hardening” beyond basics (e.g. full audit of every route).

---

## 2. Phase 2 — Production hardening (next engineering chapter)

From **`implementation-roadmap.md`**:

- Scheduled ingestion and **token refresh reliability** (not only “worker starts”).  
- **Stronger tenant isolation** reviews on all `clientId`-scoped routes.  
- **Observability:** Sentry, queue health, clearer ops signals.  
- **Leads:** optional NLP / smarter detection **only if pilots ask**.

---

## 3. Phase 3 — Scale & monetisation

- Deeper **billing** when pilots convert.  
- **Exports / reports** for agencies.  
- **White-label** only if there’s real enterprise pull.

---

## 4. Non-code / go-to-market (docs, not the compiler)

From **`2-week-plan.md`** and **`incubation-readiness.md`**:

- **Pilots:** names, consent, one simple success metric each (e.g. posts/week).  
- **Evidence:** quotes, optional before/after habits, IG screenshots with permission — **no invented DAU/revenue**.  
- **Demo discipline:** rehearse **`docs/demo-script.md`** before high-stakes meetings.  
- **Docs alignment:** seeded demo logins are listed in **`docs/launch-checklist.md`** and **`README.md`** (keep them in sync when seed changes).

---

## 5. Ongoing hygiene

- **`npx prisma generate`** **EPERM** on Windows when file locks appear — operational (close locks, elevated terminal, retry); not a product feature gap.  
- **Browser QA** before big demos: use the checklist’s **2-minute manual pass** — terminal smoke does not replace clicking through the dashboard.

---

## Quick links

| Doc | Use |
|-----|-----|
| [launch-checklist.md](./launch-checklist.md) | Pre-demo env, processes, smoke, logins |
| [demo-script.md](./demo-script.md) | Live walkthrough |
| [incubation-readiness.md](./incubation-readiness.md) | Metrics and honest language |
| [local-dev.md](./local-dev.md) | Setup and curl checks |
