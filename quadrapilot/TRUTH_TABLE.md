# QuadraPilot — system truth table (Cycle 5 baseline)

Verified state entering Cycle 5. Re-run the commands in the left column before claiming a cycle complete.

| Metric | Baseline | Verify |
|--------|----------|--------|
| Test files | **10** | `npx vitest run --reporter=verbose` |
| Tests passing | **51/51** | same |
| TSC errors | **0** | `npx tsc --noEmit` |
| Lint errors | **0** | `npm run lint` |
| Smoke (delivery) | **6/6** | `npm run smoke:render` |
| **smokeGate** | `PASSED` \| `FAILED` \| `SKIPPED` | See `quadrapilot/README.md` — delivery reports require **PASSED** (live Render). |
| Locked PDF queue files | **0 diff** | `git diff HEAD -- src/lib/pdfQueueObservability.ts src/lib/pdfQueueMetricsFlush.ts` |

## History: Cycle 4 floor (48/48, 9 files)

See archived note: pre-`briefingDispatch` snapshot was **45** tests / **8** files; **`tests/briefingDispatch.test.ts`** +3 → **48**. **`tests/api.test.ts`** and **`tests/whatsapp.test.ts`** explained the old “46 vs 48” confusion (documented Cycle 4).

**Cycle 5 rule:** Floor is **51/51** until the next intentional test addition. Do not delete passing tests to “fix” counts.

## Cycle 5 — live end-to-end briefing (operator checklist)

Formal delivery requires a **live** run (not `SMOKE_ENV=skip`). Fill in after you run it on infrastructure you control:

| Field | Value (operator) |
|-------|------------------|
| Date (UTC) | _YYYY-MM-DD_ |
| `DEBUG_BRIEFING` | Should be `1` for first run logs. |
| `BRIEFING_E2E_TEST_DELAY_MS` / `BRIEFING_E2E_TEST_CLIENT_ID` | Optional one-shot; or cron / BullMQ tick. |
| Twilio message SID | `SM` + 32 hex (from logs when `DEBUG_BRIEFING=1`) |
| Phone physically received WhatsApp? | YES / NO |

**Job payload (actual code contract):** BullMQ job name `send-brief`, queue `whatsapp-send`, data fields **`phoneE164`**, **`briefingText`**, **`dateStr`** (not `to` / `body` — those names are conceptual only).

## Per-file test inventory (Cycle 5)

| File | Tests (approx.) |
|------|-----------------|
| `tests/api.test.ts` | 23 |
| `tests/briefingDispatch.test.ts` | 4 |
| `tests/circuitBreaker.test.ts` | 2 |
| `tests/liveBriefingInstrumentation.test.ts` | 1 |
| `tests/mergeAnalyticsEvents.test.ts` | 3 |
| `tests/pdfBranding.test.ts` | 1 |
| `tests/pdfFairPriority.test.ts` | 5 |
| `tests/pdfService.test.ts` | 3 |
| `tests/transcribe.test.ts` | 4 |
| `tests/whatsapp.test.ts` | 5 |

Re-count with: `rg '^\s*it\(' tests -g '*.test.ts'`.
