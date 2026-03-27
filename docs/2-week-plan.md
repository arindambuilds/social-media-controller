# 2-week MVP plan (solo founder, ~5–8 h/day)

Assumes **Bhubaneswar** pilot positioning and **Instagram-only** scope.

## Week 1 — Stability + trust path

| Day | Focus | Outcome |
|-----|--------|---------|
| 1 | Env + DB + Redis | `.env` complete; `prisma migrate`; seed runs; API + worker start without errors |
| 2 | Auth | Login/signup/refresh tested from dashboard; `/api/auth/me` drives client context |
| 3 | Instagram OAuth | Meta app + redirect URIs (`INSTAGRAM_FRONTEND_REDIRECT_URI` + API callback); one successful connect **or** mock-only demo locked |
| 4 | Ingestion | Worker processes jobs; `INGESTION_MODE` documented; re-run sync after connect |
| 5 | Dashboard core | Home → Analytics → Insights flow; empty states; loading states |

## Week 2 — AI + demo + pilots

| Day | Focus | Outcome |
|-----|--------|---------|
| 6–7 | AI | Insights + captions + recommendation with real key; graceful fallback without key |
| 8 | Demo data | Seed business narrative (Odisha salon-style); captions feel real |
| 9 | Demo script | 15‑min walkthrough rehearsed ([demo-script.md](./demo-script.md)) |
| 10 | Pilots | 5 businesses: name, phone, consent, **one** success metric each (e.g. “posts/week”) |

## Daily rhythm (practical)

1. **Morning:** one feature or one bug; run `npm run lint` + smoke test.  
2. **Midday:** update one doc if behaviour changed.  
3. **Evening:** 10‑min demo dry-run once/week.

## Explicit deferrals (protect the timeline)

- New platforms beyond Instagram  
- Heavy NLP on leads  
- Subscription billing code (can be manual invoices for first pilots)
