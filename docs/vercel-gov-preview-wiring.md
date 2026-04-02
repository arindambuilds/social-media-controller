# Frontend → API wiring: `/gov-preview` on Vercel (Task 15)

**Goal:** The public dashboard page **`/gov-preview`** loads from **Vercel**, fetches metrics from the **Render** API, and uses **ISR** (`revalidate = 3600`).

Implementation: `dashboard/app/gov-preview/page.tsx` — `export const revalidate = 3600` and `fetch(..., { next: { revalidate: 3600 } })`.

---

## 1. Set `NEXT_PUBLIC_API_URL` on Vercel

**Vercel → Project → Settings → Environment Variables**

| Name | Value (example) | Notes |
|------|-----------------|--------|
| `NEXT_PUBLIC_API_URL` | `https://social-media-controller.onrender.com` | **API origin only** — **no** trailing slash, **no** `/api` suffix. |

The page builds the request URL as:

- strip trailing `/`
- if the value does **not** end with `/api`, append **`/api`**
- then append **`/pulse/gov-preview`**

So both `https://api.example.com` and `https://api.example.com/api` are accepted; the canonical choice for operators is **origin without `/api`** (matches `dashboard/.env.example` and `docs/DEMO.md`).

**Scopes:** Apply to **Production** (and Preview if you want preview deployments to hit a staging API).

---

## 2. Redeploy the dashboard

`NEXT_PUBLIC_*` variables are inlined at **build** time. After adding or changing `NEXT_PUBLIC_API_URL`:

1. **Deployments → Redeploy** the latest production deployment, **or** push a commit to the branch Vercel builds from.

Skipping redeploy leaves old baked-in URLs in the client/server bundle.

---

## 3. Verify `/gov-preview` in production

Open:

`https://<your-vercel-domain>/gov-preview`

### Visual / UX

- [ ] Dark background, readable typography  
- [ ] **Three** metric cards: **MSMEs on Pulse** (`msmes`), **Leads this week** (`leadsThisWeek`), **Odia briefings** (`odiaPercent` with `%`)  
- [ ] **5T alignment** section (Technology / Transparency / Transformation bullets)  
- [ ] Footer with **Home** link  
- [ ] **Last refreshed:** shows `updatedAt` when the API returns it, or *“Awaiting first cache refresh from the API worker.”* when `updatedAt` is null  

### DevTools

- [ ] **No 500** on the document navigation  
- [ ] **Network:** initial document **200** (or 304). Metrics are loaded **on the server** during render (RSC), so you may not see a separate browser XHR to Render for the JSON — failures often surface as **zeros** / empty refresh line unless you inspect server logs on Vercel.

If all metrics stay **0** and the API is known to have non-zero data, confirm Render **`GET /api/pulse/gov-preview`** returns JSON (see [production-parity-runbook.md](./production-parity-runbook.md)) and that Vercel’s baked `NEXT_PUBLIC_API_URL` matches that host.

---

## 4. ISR / cache (up to ~1 hour)

- Page-level: **`revalidate = 3600`** (seconds).  
- Fetch: **`next: { revalidate: 3600 }`** — same cadence for the data cache.

**Optional check:** change a driver in **DB or API** (e.g. refresh gov metrics job / Redis key, or seed data), wait **up to 60 minutes**, reload `/gov-preview` (hard refresh may still show CDN cache; Vercel/Next may serve stale until revalidation). For a quicker loop, use a **preview deployment** with a short revalidate (dev only — do not commit) or trigger a new deployment to bust cache.

---

## 5. CORS note

`/gov-preview` loads data in a **Server Component** (`fetch` on Vercel’s server → Render). The browser does not call Render for that JSON directly, so **browser CORS** does not apply to this metrics fetch. (Client-side API calls elsewhere still need `CORS_ORIGIN` aligned on the API.)

---

## Related

- [production-parity-runbook.md](./production-parity-runbook.md) — Render route + DB parity  
- [cycle3-antigravity-tech-status.md](./cycle3-antigravity-tech-status.md) — Task 15 naming; **Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).** — run against the **API** host (`npm run smoke:render` / `--base`), not the Vercel URL.  
- [DEMO.md](./DEMO.md) — full Vercel env checklist  
