# Smoke harness — next 24–72 hours (operator runbook)

> INTERNAL USE ONLY
>
> This runbook is for internal smoke checks and includes seeded login flow references. Do not share it externally.

Single script: **`scripts/smoke-demo.ts`**. Canonical contract line (printed when green): **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).**

---

## Production sync checklist (Render)

- `npx prisma migrate deploy` (against production `DATABASE_URL` / `DIRECT_URL` as documented).
- `npx prisma generate`
- `npm run build`
- Commit and `git push origin production` (or whatever branch Render builds from).
- In Render: **trigger deploy** for **social-media-controller** and wait until **Live**.
- **Restart** the **worker** service (BullMQ) if it runs as a separate Render service.
- `npm run smoke-demo -- --url https://social-media-controller.onrender.com` — expect **7/7** and the canonical contract line.

---

## 1. Environments and base URLs (no confusion)

| Environment | Base URL (examples) | Notes |
|-------------|---------------------|--------|
| **Local API** | `http://localhost:4000` | Dev server; DB seeded (`npm run prisma:seed`). |
| **Production API (Render)** | `https://social-media-controller.onrender.com` | **API origin only** — baked into `npm run smoke:render` in root `package.json`. Replace with your real host if different (e.g. `https://pulseos-api.onrender.com`). |
| **Dashboard (Vercel)** | `https://…vercel.app` | **Do not** pass this to the smoke script — smoke hits the **API**, not Next.js. |

**Rule:** Smoke `BASE` = **Render (or local) API origin**, no `/api` suffix on the flag (the script appends `/api/...` paths).

---

## 2. Run smoke locally; fix regressions

From repo root, with API + DB running:

```bash
npm run smoke:local
# equivalent:
npx tsx scripts/smoke-demo.ts --url http://localhost:4000
```

**Resolution order:** `--base` → `--url` → `SMOKE_BASE_URL` / `SMOKE_URL` → default `http://localhost:4000`.

### Interpret the output

- Table per check; **`↳`** lines show the error snippet.  
- **`Overall: 7/7 passed`** and **`✓ Smoke test: 7/7 checks …`** → green locally.  
- If not all pass, you see **`Gate not met. When green: …`** (contract line as target).

### Triage order (same as priority for demo)

1. **Health** — `GET /api/health`, expect **`status: "ok"`** and **200**.  
2. **Login** — `demo@demo.com` / `Demo1234!`; **`accessToken`** + **`user.clientId`**.  
3. **Analytics / AI Insights / Leads / Posts** — seed + handlers (numbers/arrays per contract).  
4. **Gov preview** — `GET /api/pulse/gov-preview`; numeric **`msmes`**, **`leadsThisWeek`**, **`odiaPercent`**; **`updatedAt`** nullable.

Stay until **7/7** is reliable locally.

---

## 3. Run smoke against Render (API origin only)

After deploy + **`prisma migrate deploy`** on production DB:

```bash
npm run smoke:render
```

Uses the **default** Render URL from `package.json`. Override:

```bash
npm run smoke:render -- --base https://your-api.onrender.com
npx tsx scripts/smoke-demo.ts --url https://your-api.onrender.com
SMOKE_BASE_URL=https://your-api.onrender.com npx tsx scripts/smoke-demo.ts
```

### Triage (production-specific)

| Symptom | Likely cause |
|---------|----------------|
| **Login** fails on Render, OK locally | Production DB not seeded; wrong `DATABASE_URL`; demo user missing. |
| **Gov preview** fails | Route not deployed; migrations missing; Redis/API shape mismatch. |

Re-run until **`✓ Smoke test: 7/7 checks …`** — then you can say **“Production smoke contract is 7/7 green.”**

---

## 4. CI / regression gate

**Already wired:** push to **`main`** runs **`.github/workflows/deploy.yml`** → after tests/lint/deploy hook, job **`smoke-render`** runs **`npm run smoke:render`** (fails the pipeline if smoke exits non‑zero).

**Scheduled / manual:** **`.github/workflows/smoke-render-scheduled.yml`** — cron **every 6 hours** UTC + **`workflow_dispatch`**. Optional repo secret **`SMOKE_BASE_URL`** overrides the default API origin for that workflow only. Ensure **Actions** are enabled for the repo; scheduled workflows can be paused in **Settings → Actions → General**.

**Slack / status:** Copy the line the script prints when green:

`✓ Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).`

---

## 5. Demo narrative (reuse the harness)

**Technical (co-founder / angel):**  
“We gate production with an API smoke script: **7 checks** in fixed order — Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts — all must pass before we call the build shippable.”

**Non-technical:**  
“Before a demo we run an automated health scan: login, data, AI insights, and the government preview endpoint — **7 checks** must pass.”

---

## 6. Concrete next steps

1. **Now:** `npm run smoke:local` → fix until **7/7**.  
2. **After Render + migrations:** `npm run smoke:render` → fix until **7/7**.  
3. **Ongoing:** Rely on **`deploy.yml`** post-deploy smoke; enable **`smoke-render-scheduled.yml`** for periodic probes; paste green contract line to Slack when useful.

---

## Related

- [`cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md) — same 7/7 wording + Task 15.  
- [`production-parity-runbook.md`](./production-parity-runbook.md) — Gov preview + DB parity.  
- [`final-demo-hardening.md`](./final-demo-hardening.md) — last-24h checklist.  

If smoke fails, paste the **full table + Overall line** from `npm run smoke:render` into an issue or chat for line-by-line debugging.
