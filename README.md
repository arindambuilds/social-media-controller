# Instagram Growth Copilot (MVP)

**Status:** **MVP release candidate** — frozen scope; prioritize demos, pilots, and smoke verification over new features.

**What it is:** An **Instagram-first AI copilot** for **local businesses and creators in India** — connect Instagram, see clear performance signals, and get AI-backed insights and content help. Built for **demos, pilots, and early revenue**, not as an all-platform social suite.

**Origin:** Product development from **Bhubaneswar, Odisha** — designed for realistic use by salons, cafés, gyms, boutiques, coaches, and neighbourhood service brands.

---

## Product (one screen)

| For | Promise |
|-----|--------|
| Salon / café / gym owner | “See what’s working on Instagram and what to post next — without a marketing team.” |
| Creator | “Turn your IG data into simple next steps and caption ideas.” |

**In scope (MVP):** Instagram connect (OAuth), ingestion (real or mock), analytics summaries, AI insights, recommendations, captions, dashboard.

**Out of scope (for now):** Full multi-network publishing, ads management, enterprise SSO, mobile apps.

---

## Stack

| Layer | Tech |
|--------|------|
| API | Node.js, Express 5, TypeScript |
| Data | PostgreSQL, Prisma |
| Jobs | Redis (e.g. Upstash), BullMQ |
| Dashboard | Next.js 15 (see `dashboard/`) |

---

## Quick start (Windows-friendly)

Full steps: **[docs/local-dev.md](docs/local-dev.md)** (Postgres local + **Upstash Redis**, no Docker required).

```powershell
copy .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, JWT_*, ENCRYPTION_KEY, INGESTION_MODE=mock for demos
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Terminal 1 — API:

```powershell
npm run dev
```

Terminal 2 — ingestion worker (required for sync jobs):

```powershell
npm run worker
```

Terminal 3 — dashboard:

```powershell
npm run dashboard:dev
```

- API: `http://localhost:4000` · Dashboard: `http://localhost:3000`  
- Demo logins (after seed — same table as **`docs/launch-checklist.md`**):

  | Role | Email | Password |
  |------|--------|----------|
  | Admin / founder demo | `admin@demo.com` | `admin123` |
  | Client (pilot UX) | `salon@pilot.demo` | `pilot123` |
  | Agency admin (presentations) | `demo@agencyname.com` | `Demo1234!` |

- Set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `dashboard/.env.local` if needed.

**Mock vs real Instagram:** `INGESTION_MODE=mock` uses synthetic sync (best for investor/mentor demos without Meta app review). `INGESTION_MODE=instagram` uses the Instagram ingestion path when tokens and Graph API access are configured.

---

## Documentation map

| Doc | Purpose |
|-----|---------|
| [docs/local-dev.md](docs/local-dev.md) | Env, migrations, seed, curl checks |
| [docs/mvp-product.md](docs/mvp-product.md) | Positioning, MVP promise, what to ignore |
| [docs/2-week-plan.md](docs/2-week-plan.md) | Founder-sized execution plan |
| [docs/demo-script.md](docs/demo-script.md) | 8-step live demo story (local business) |
| [docs/incubation-readiness.md](docs/incubation-readiness.md) | Metrics, language, pilot evidence (no hype) |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Pre-demo env + smoke + manual pass |
| [docs/completion-report.md](docs/completion-report.md) | Endpoints, workers, founder Done / next (repo-aligned) |
| [docs/implementation-roadmap.md](docs/implementation-roadmap.md) | Longer-term phases |
| [docs/mvp-status-one-pager.md](docs/mvp-status-one-pager.md) | Status, investor/pilot outline, Phases 2–3 + GTM |
| [docs/pilot-operational-readiness.md](docs/pilot-operational-readiness.md) | Evidence vs narrative: tenant isolation, OAuth/Redis, gov-facing discipline |

---

## API surface (high level)

- Auth: `POST /api/auth/signup`, `login`, `refresh`, `GET /api/auth/me`
- Instagram OAuth: `GET /api/auth/oauth/instagram/authorise`, callback, plus `social-accounts/instagram/start`
- Analytics: `/api/analytics/...` (overview, posts, insights — see app routes)
- AI: `/api/ai/...`, `/api/insights/...`
- Webhooks: ingestion enqueue under `/api/webhooks/...`

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API dev |
| `npm run worker` | Ingestion worker |
| `npm run build` | Compile API |
| `npm run lint` | Typecheck API |
| `npm run prisma:seed` | Seed demo data |
| `npm run dashboard:build` | Production build of dashboard |
| `npm run smoke:demo` | Hit health, login, me, analytics, insights, leads (API must be up) |
| `npm run pdf:mvp-one-pager` | Build `docs/mvp-status-one-pager.pdf` from the Markdown (uses Microsoft Edge) |
| `npm test` | Vitest API smoke (needs `DATABASE_URL` + `REDIS_URL` in env) |

---

## Security

- JWT for API auth; refresh tokens supported  
- OAuth `state` validated via Redis  
- Social tokens encrypted at rest (see `src/lib/encryption.ts`)  
- Role checks on agency-only routes  

---

## Licence

Private / use per your team policy.
