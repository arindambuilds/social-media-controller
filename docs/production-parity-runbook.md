# Production API + DB parity (Render)

**Goal:** Render API behavior and Postgres schema match the current repo (including `GET /api/pulse/gov-preview` and pioneer / `language` columns on `Client`).

---

## 1. Deploy latest backend

1. Merge to **`main`** and confirm the Render **Web Service** finishes a green build + deploy.
2. Build should run **`npm run build`** (which runs **`prebuild` → `prisma generate`**) so the compiled app matches `schema.prisma`.
3. **Start command** should remain: `npx prisma migrate deploy && node dist/server.js` (see [`DEPLOYMENT.md`](../DEPLOYMENT.md)) so migrations apply on every boot **unless** you intentionally removed migrate from start (then run §3 manually after each schema change).

---

## 2. Sanity check: `GET /api/pulse/gov-preview`

**No auth.** Expect **`200`** and JSON:

```json
{
  "msmes": <number>,
  "leadsThisWeek": <number>,
  "odiaPercent": <number>,
  "updatedAt": "<iso-string> | null"
}
```

Zero-state is valid when Redis has no cached metrics yet (`msmes` / `leadsThisWeek` / `odiaPercent` may be `0`, `updatedAt` may be `null`). The handler must **not** return HTML or 404.

### Windows (PowerShell)

```powershell
curl.exe -sS -i "https://social-media-controller.onrender.com/api/pulse/gov-preview"
```

### macOS / Linux

```bash
curl -sS -i "https://social-media-controller.onrender.com/api/pulse/gov-preview"
```

Replace the host if your production API URL differs.

---

## 3. `prisma migrate deploy` on Render’s database

**If migrations are not in the start command:** open **Render Dashboard → your API service → Shell** (or SSH), with production env loaded, and run:

```bash
npx prisma migrate deploy
```

Use the same **`DATABASE_URL`** (and if applicable **`DIRECT_URL`**) as production. For Supabase-hosted DBs, migrations against **`DIRECT_URL`** (`:5432`) are the usual choice when the pooler blocks DDL.

**Confirm** migration folder is applied:

```bash
npx prisma migrate status
```

You should see **`20260331180000_pioneer_fields`** (and others) as applied, not pending.

**Optional — verify columns** (adjust table name quoting for your SQL client):

```sql
-- "Client" is quoted in Prisma/Postgres for PascalCase model names in some setups; use \d "Client" in psql or information_schema.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Client'
  AND column_name IN ('pioneerCohort', 'pioneerPriceInrUntil', 'demoEndsAt', 'language');
```

---

## 4. Parity log (paste into Notion / Slack / cycle notes — after you have verified §2–§3)

Use this **exact** line once production is confirmed:

> **Production DB (Render) is now at migration `20260331180000_pioneer_fields`; dev DB is Supabase, also at this migration.**

Add a dated footnote if useful, e.g. *Verified YYYY-MM-DD operator initials.*

---

## 5. Automated / manual probe log (do not treat as production truth)

| Date (UTC) | Host | `GET /api/pulse/gov-preview` |
|------------|------|------------------------------|
| 2026-03-31 | `social-media-controller.onrender.com` | **404** on `GET /api/pulse/gov-preview` — **`npm run smoke:render` stays 6/7** until API redeploy includes gov route. `/api/health` **200**. After deploy: expect full **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).** |

Update this table after the next production deploy when §2 passes.

---

## Related

- [`cycle3-antigravity-tech-status.md`](./cycle3-antigravity-tech-status.md) — smoke **7/7** includes Gov preview.
- [`production-verification-checklist.md`](./production-verification-checklist.md) — broader release checks.
- [`vercel-gov-preview-wiring.md`](./vercel-gov-preview-wiring.md) — **Vercel** `NEXT_PUBLIC_API_URL`, redeploy, `/gov-preview` verification, ISR.
