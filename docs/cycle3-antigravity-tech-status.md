# Cycle 3 / Antigravity — Tech Status

**Repo source of truth** for Slack, Notion (“Cycle 3 / Antigravity – Tech Status”), and stakeholder updates. Copy this file into Notion when you refresh the page; keep wording aligned with commits.

---

## Morning briefing cron (canonical phrasing)

Use this exact description in docs and Slack — **do not** describe production scheduling as a UTC-only string.

**9:00 Asia/Kolkata** — cron pattern **`0 9 * * *`** with timezone **`Asia/Kolkata`** (BullMQ repeatable and/or node-cron with the same `tz`).

- Nine-AM-only mode: `whatsappBriefingQueue` repeatable job — `0 9 * * *`, `tz: "Asia/Kolkata"`.
- Per-client hourly dispatch: `0 * * * *`, `tz: "Asia/Kolkata"` (top of each hour IST).
- Opt-in bilingual node-cron (`PULSE_BILINGUAL_CRON=1`, no Redis): same **`0 9 * * *`**, `timezone: "Asia/Kolkata"`.

See also `DEPLOYMENT.md` → “Morning briefing”.

**Stakeholder deck sentence + rehearsal checklist:** [briefing-9am-ist-rehearsal.md](./briefing-9am-ist-rehearsal.md).

---

## Smoke delivery gate: **7/7** checks

**Smoke test (single source of truth):** Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).

`npm run smoke:render` runs `scripts/smoke-demo.ts` against production Render. A **passing** run prints `Overall: 7/7 passed` and the line above. Override API host: `npm run smoke:render -- --base https://<api-host>` or `SMOKE_BASE_URL`.

| # | Check        | What it validates |
|---|--------------|-------------------|
| 1 | Health       | `GET /api/health` |
| 2 | Login        | Primary operator JWT + `clientId` |
| 3 | Analytics    | Instagram summary for `clientId` |
| 4 | AI Insights  | Content-performance insight POST |
| 5 | Leads        | `{ leads: [], total: number }` shape |
| 6 | Gov preview  | `GET /api/pulse/gov-preview` — `msmes`, `leadsThisWeek`, `odiaPercent` |
| 7 | Posts        | `GET /api/posts` array |

**Deprecated language:** do not use **“6/6”** anywhere — that count predates the Gov preview check.

QuadraPilot Stage 4 treats smoke as **PASSED** only when the script exits `0` **and** the summary line is **`N/N`** with all checks passed (`N` equals total and matches `scripts/smoke-demo.ts`).

**Step-by-step (local → Render → CI → narrative):** [smoke-harness-runbook.md](./smoke-harness-runbook.md)

---

## Task numbering (Antigravity)

**Task 15 — Gov preview public dashboard** — Next.js **`/gov-preview`** (ISR `revalidate: 3600`), public metrics UI, backed by **`GET /api/pulse/gov-preview`**. Use **“Task 15”** consistently in Slack and specs when referring to this work.

Tasks 1–14 remain as in the original Antigravity checklist (leads shape, prebuild, Prisma pioneer fields, seed-demo, WhatsApp queue, Claude client, briefing dispatch, tests, gov metrics job, gov API route, CI smoke, onboarding, WowCard, UpgradeModal).

---

## Where `prisma migrate deploy` ran (wording)

When reporting migration history to a co-founder or investor:

- Say **remote dev database (Supabase)** or **primary dev database** when migrations were applied against the shared Supabase Postgres URL — **not** “local Postgres” or “laptop-only DB,” unless you literally ran against `localhost:5432`.
- **Production (Render)** parity is a separate step: run **`npx prisma migrate deploy`** against the **production** `DATABASE_URL` / `DIRECT_URL` pair after deploy.

---

## Quick verify commands

```bash
npm test
npm run smoke:render
npx tsc --noEmit
npm run lint
```

**Last aligned:** March 2026 · Bhubaneswar
