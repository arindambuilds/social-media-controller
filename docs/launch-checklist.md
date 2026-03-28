# Launch / demo checklist

Use before a **mentor meeting**, **incubator pitch**, or **pilot onboarding**.

**Engineering snapshot (what’s shipped vs what’s left):** see **[docs/completion-report.md](./completion-report.md)** — includes a founder-style **Done / In progress / Next** section aligned with the current repo.

## MVP freeze boundary (release candidate)

**In scope for this MVP**

- Auth: signup / login / refresh / `me` with JWT; dashboard stores token + `clientId`.
- Seeded demo: Urban Glow Studio (`demo-client`), dual logins (admin + pilot client).
- Analytics: overview, charts, top posts (from `Post.engagementStats` + seed).
- AI: content-performance insight (latest + generate), weekly focus recommendation, captions (stubs without OpenAI).
- Leads: list + status patch, aligned with `LeadStatus` enum.
- Onboarding: OAuth authorise URL for agency and client users; mock ingestion for demos.

**Explicitly out of scope (defer)**

- Multi-platform publishing, ads, enterprise SSO, mobile apps.
- Full billing / payments (usage counter only).
- Production hardening beyond basics (rate limits, audit completeness).

**End-to-end paths that must work for freeze**

1. Migrate + seed → API + dashboard up → login → Analytics populated.  
2. Insights → see seeded insight OR generate; weekly focus button; captions.  
3. Leads table for `demo-client`.  
4. `npm run smoke:local` (or `npm run smoke:render` against production API) green.

## Environment

- [ ] Root `.env`: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `ENCRYPTION_KEY` (32+ chars), `APP_BASE_URL`
- [ ] `INGESTION_MODE=mock` for demos without Meta (or `instagram` + valid Meta app)
- [ ] `dashboard/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000` (origin only; code appends `/api`)
- [ ] Optional: `OPENAI_API_KEY` for best AI output

## Data

- [ ] `npm run prisma:migrate` (or `deploy`) applied
- [ ] `npm run prisma:seed` run (Urban Glow demo + leads + pilot user)

## Processes

- [ ] Terminal 1: `npm run dev` (API on :4000)
- [ ] Terminal 2: `npm run worker` (ingestion queue)
- [ ] Terminal 3: `npm run dashboard:dev` (:3000)

## Automated check

With API running (worker not required for smoke):

```powershell
npm run smoke:local
```

Against production API (after cold start may need a retry):

```powershell
npm run smoke:render
```

Script checks in order: **`GET /api/health`**, login (`demo@demo.com` / `Demo1234!`), Instagram **summary**, **AI insight** POST, **leads** list, **posts** list (uses `clientId` from the login response). Override base URL: `npx tsx scripts/smoke-demo.ts --url https://your-api.example.com`.

## Logins (after seed)

| Role | Email | Password |
|------|--------|----------|
| Admin / founder demo | `admin@demo.com` | `admin123` |
| Client (pilot UX) | `salon@pilot.demo` | `pilot123` |
| Agency admin (presentations / alternate demo) | `demo@agencyname.com` | `Demo1234!` |

`npm run smoke:local` / `smoke:render` use **`demo@demo.com`** / **`Demo1234!`**; **`clientId`** comes from the login payload (must match a seeded user with a client).

## Manual 2-minute pass (before every demo)

1. Login → **Analytics** loads charts and metrics  
2. **Insights** → latest insight visible or generate; **This week’s focus** → Get weekly focus  
3. **Captions** → generate and skim output  
4. **Leads** → seeded names and statuses  
5. **Onboarding** → **Connect Instagram** returns an authorise URL (503 if Meta app id missing — explain mock path)

**If real Instagram is unavailable:** keep `INGESTION_MODE=mock`, say seed + worker jobs simulate sync; do not claim live Graph data.

## Do not claim without proof

- Live customer logos, revenue, or DAU — use **pilot** language until you have signed references.

---

## Operator runbook (recommended order)

**Phase A — Lock MVP (1–3 days, no new features)**  
1. Check every box in this file (Environment → Data → Processes).  
2. Confirm Vercel `NEXT_PUBLIC_API_URL` is the **API origin only** (no `/api`); see `docs/DEMO.md`.  
3. Run `npm run smoke:render` once; if Render was cold, wait ~60s and retry. Note only **blockers** (login, 404 API, empty charts).  
4. Do the **Manual 2-minute pass** on **production** (same as local, but on live URLs).

**Phase B — One validation channel**  
- **Pilot-first:** 1–2 local businesses, `INGESTION_MODE=mock`, weekly check-in, “would you pay X?” — no code unless they hit a clear gap.  
- **Product-first:** Meta app + OAuth + `INGESTION_MODE=instagram` (+ Redis if you run multiple API instances).

**Phase C — After demo stable or first pilot**  
Paid tiers (cold start), Redis, Stripe/billing — see `docs/DEMO.md` → “Next steps for a first paying customer.”

**Defer until post-MVP:** new platforms, major new routes, big UI refactors, extra planning docs beyond `mvp-product.md` + this checklist + `DEMO.md`.
