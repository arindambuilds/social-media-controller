# Pulse: Scale & Architecture Roadmap (Mar 2026)

## Current Deployment Model (CRITICAL CHOICE)

**Option A: Monolith (Render)**

```
Next.js (SSR) + Express API (/api) + Postgres → Single Render Pro dyno ($25/mo)
✅ Simple, ₹5K/mo total
❌ NDJSON fs contention kills /api/analytics/funnel at 2K DAU
```

**Option B: Split (Vercel + Render)**

```
Next.js Dashboard → Vercel (serverless /api/analytics writes to S3/Redis)
Express API → Render (heavy /api/briefing, /reports/pdf)
✅ NDJSON risk → ZERO (Vercel Functions = 100ms ephemeral writes)
❌ ₹15K/mo + cold starts
```

**RECOMMENDATION**: Split deployment. NDJSON bottleneck disappears.

## Scale Breakpoints (Fixed)

| Users | DAU | Failure Mode | Fix Priority |
|-------|-----|--------------|--------------|
| 1K | 200 | Next.js `/api/analytics` fs lock (sync appendFile) | Phase 1 → Redis streams |
| 5K | 1K | Puppeteer OOM (5+ concurrent browsers, 8GB+) | Phase 1 → BullMQ (maxDepth:3) |
| 20K | 4K | Instagram Graph bans (800K calls/day > Basic Tier) | Phase 2 → sharded queues |
| 50K | 10K | Postgres AuditLog table (50M rows/year) | Phase 3 → partitioning |

**AI Cost Validation**: 10 briefings/user/month × 30K tokens = 300K tokens/user × ₹0.1/1K = **₹30/user/month**. Realistic.

## 3-Phase Evolution (6-12 months)

### Phase 1: Stabilize (<5K users, 1 month)

```
-  PDF → BullMQ queue (3 concurrent Puppeteer browsers)
-  /api/analytics → Redis streams (fs lock gone)
-  Instagram sync → job queue w/ exponential backoff
Cost: +₹3K Redis = ₹8K total/mo
```

### Phase 2: Decouple Analytics (5-20K users, 2 months)

```
-  NDJSON → ClickHouse (funnel queries 100x faster)
-  Split deploy: Vercel (light) + Render API (heavy)
-  Agency benchmarking tables (vertical MOAT)
Cost: ₹45K/mo
```

### Phase 3: Horizontal Scale (20K+ users, 3 months)

```
-  API → AWS ECS Mumbai (₹4K/core vs Render ₹6K)
-  Postgres → Aurora Serverless v2 + read replicas
-  PDF → Gotenberg Docker service (10x faster)
Cost: ₹1.8L/mo @ 20K users
```

## Cost Model (Split Deploy, ₹/month)

| Scale | Compute | DB | AI | PDF | **Total** |
|-------|---------|----|----|-----|-----------|
| 1K users | 8K | 8K | 10K | 2K | **28K** |
| 10K users | 35K | 25K | 75K | 12K | **1.47L** |
| 50K users | 1.5L | 90K | 3L | 40K | **6.3L** |

## Key Risks Mitigated

- **PDF timeouts** → Queue depth limits
- **NDJSON scale** → ClickHouse columnar
- **Instagram bans** → Sharded queues + circuit breakers
- **AI cost** → Validated @ ₹30/user

## Defensibility

- **Data moat**: Vertical benchmarks (Odisha salons, Mumbai clinics)
- **Lock-in**: Agency multi-client + branded PDFs (logoUrl baked in)
- **Hard to copy**: Puppeteer+QuickChart pipeline + free tier metering

**Next Milestone**: Phase 1 complete → 5K user capacity → ₹50K MRR breakeven.

## Implementation notes (repo, Mar 2026)

- Dashboard `POST /api/analytics` dual-writes NDJSON + Redis stream `pulse:analytics:events` (trimmed MAXLEN ~50k) when `REDIS_URL` is set (non-localhost).
- `GET /api/analytics/funnel` merges stream + file with dedupe keys.
- API `POST /api/reports/:clientId/export/pdf` uses BullMQ queue `pdf-generate` when Redis is configured; worker concurrency **2**; Puppeteer uses `waitUntil: "load"` (not `networkidle0`) to avoid 30–40s stalls on chart URLs; Chromium args include `--disable-dev-shm-usage`.
- BullMQ uses **duplicated** Redis connections for the PDF queue / QueueEvents / Worker (`createBullMqConnection()`); shared client uses `maxRetriesPerRequest: null` (BullMQ requirement).
- PDF **backpressure**: if `waiting > 15` or `active > 3`, new exports get **503** with a clear message.
- Health: `/health`, `/api/health?deps=1`, and `/api/health` (db router) wrap dependency probes in a **5s** timeout so probes cannot wedge the process.
- **`START_PDF_WORKER_IN_API=false`**: do not embed the PDF worker in the web process; run `npm run worker:pdf` on a **separate** Render service (and do **not** also embed — avoids duplicate consumers doubling concurrency). Default (unset) keeps the in-process worker for single-dyno deploys.
- **Circuit breaker**: `pdf_export` opens after **5** failures in **30s**; `GET /api/health/degraded` exposes `circuit.state` + `pdfQueue` counts for monitors.
- **Load smoke (read-only)**: `npm run load:health` (local) / `npm run load:health:staging` — Artillery 20 rps × 2 min on health endpoints; extend with JWT flows separately.
- **Stress (50 RPS × 10 min API)**: `npm run load:stress` / `load:stress:staging`. **Dashboard analytics**: `load:stress:dashboard` / `load:stress:dashboard:staging`. **PDF (needs token)**: `ARTILLERY_BEARER_TOKEN` + `load:stress:pdf`.
- **Fail-fast LB probe**: `GET /api/health/critical` → **503** if PDF circuit OPEN or `waiting>20`.
- **Operator metrics** (optional): set `METRICS_SECRET` (≥24 chars), then `GET /api/metrics` with header `x-pulse-metrics-key`.
- **PDF export**: **10/min per user** (`PDF_RATE_LIMIT`); BullMQ job **timeout 120s**; hourly **clean** of failed jobs older than 24h; worker **`maxStalledCount: 3`**.
- **PM2**: see root `ecosystem.config.cjs` for split API + PDF worker.
