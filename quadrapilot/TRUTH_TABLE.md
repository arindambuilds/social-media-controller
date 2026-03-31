# QuadraPilot — system truth table (Cycle 6 baseline)

**Smoke test (single source of truth):** Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).

Re-run the **Verify** column before claiming a cycle complete.

**Stakeholder copy (cron, smoke 7/7, Task 15, migrate wording):** [`docs/cycle3-antigravity-tech-status.md`](../docs/cycle3-antigravity-tech-status.md)

| Metric | Baseline | Verify |
|--------|----------|--------|
| Test files | **16** | `npx vitest run --reporter=verbose` |
| Tests passing | **68/68** | `npm test` |
| TSC errors | **0** | `npx tsc --noEmit` |
| Lint errors | **0** | `npm run lint` |
| Smoke (delivery) | **7/7** | `npm run smoke:render` or `-- --base <api>` / `SMOKE_BASE_URL` — same seven names as the line above |
| **smokeGate** | `PASSED` \| `FAILED` \| `SKIPPED` | Formal delivery ⇒ **PASSED** (live Render), never **SKIPPED**. |
| Locked PDF queue files | **0 diff** | `git diff HEAD -- src/lib/pdfQueueObservability.ts src/lib/pdfQueueMetricsFlush.ts` |
| **Live E2E sign-off (C1)** | **PENDING** | Operator: phone + Render logs — see below. |

**Job payload (frozen — do not change):** queue **`whatsapp-send`**, name **`send-brief`**, data **`{ phoneE164, briefingText, dateStr }`**.

**Floor:** **68** tests / **16** files (March 2026). New tests only increase the count.

**Task 15 — Gov preview public dashboard:** Next.js `/gov-preview` + `GET /api/pulse/gov-preview` (smoke check #6).

---

## Blocker C1 — live WhatsApp E2E (blocks F1–F3 until PASS)

This step is **not executable from CI or Cursor**: you must use **Render logs + your phone**. Follow **`quadrapilot/README.md`** (First live briefing) and Cycle 6 protocol steps 1–8.

| Field | Operator fills after run |
|-------|---------------------------|
| Live E2E sign-off date | _YYYY-MM-DD_ |
| Test `clientId` used | e.g. `demo-client` |
| `[scheduler] Loaded` seen at boot? | YES / NO |
| `[scheduler] Tick fired at:` (E2E or cron) | _ISO timestamp_ |
| `[briefing] Claude response length:` | _N > 0_ |
| `[briefing] Job enqueued…` | YES / NO |
| `[whatsapp] Job picked up. To:` | _E.164_ |
| Twilio SID | `SM` + 32 hex **or** exact Twilio **error code** |
| Phone received WhatsApp? | **YES** / NO (if NO: paste **Twilio Messaging log status** — constraint 19) |
| E2E env vars removed + clean redeploy? | YES / NO |

**Status:** **PENDING** until **YES** on phone + SID + cleanup. **F1, F2, F3 are deferred** until C1 = PASS (constraint 18).

---

## Feature work after C1 (Cycle 6 protocol — do not start until C1 PASS)

| ID | Task | Status |
|----|------|--------|
| **F1** | Audit `DEBUG_BRIEFING` guards; test: no `[briefing]` / `[whatsapp]` logs when unset during executor | **DEFERRED** (blocked by C1) |
| **F2** | Production cron + TZ log + test for IST intent | **DEFERRED** — operator must set intended send time (constraint 21) |
| **F3** | Answer Q1–Q3 (client list, briefing flag, Year-1 scale) in this file | **DEFERRED** until C1 PASS |

---

## History

- **Cycle 5:** Instrumentation + tests → **51/51**, **10** files; live phone **not** verified in-repo.
- **Cycle 4:** **48/48**, **9** files; count correction vs mistaken “46”.
- **Job contract** codified Cycle 5 (`phoneE164` / `briefingText`, not `to` / `body`).

## Per-file test inventory (March 2026)

| File | Tests (approx.) |
|------|-----------------|
| `tests/api.test.ts` | 23 |
| `tests/briefing.test.ts` | 3 |
| `tests/briefingDispatch.test.ts` | 4 |
| `tests/briefingDispatchBilingual.test.ts` | 4 |
| `tests/briefingWhatsAppTemplates.test.ts` | 3 |
| `tests/circuitBreaker.test.ts` | 2 |
| `tests/claudeClient.test.ts` | 3 |
| `tests/govMetrics.test.ts` | 1 |
| `tests/liveBriefingInstrumentation.test.ts` | 1 |
| `tests/mergeAnalyticsEvents.test.ts` | 3 |
| `tests/pdfBranding.test.ts` | 1 |
| `tests/pdfFairPriority.test.ts` | 5 |
| `tests/pdfService.test.ts` | 3 |
| `tests/pulsePlanResolver.test.ts` | 3 |
| `tests/transcribe.test.ts` | 4 |
| `tests/whatsapp.test.ts` | 5 |

Re-count: `rg '^\s*it\(' tests -g '*.test.ts'`.
