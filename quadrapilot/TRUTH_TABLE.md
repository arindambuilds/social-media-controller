# QuadraPilot — system truth table (Cycle 4 baseline)

Verified state entering Cycle 4. Re-run the commands in the left column before claiming a cycle complete.

| Metric | Baseline | Verify |
|--------|----------|--------|
| Test files | **9** | `npx vitest run --reporter=verbose` |
| Tests passing | **48/48** | same |
| TSC errors | **0** | `npx tsc --noEmit` |
| Lint errors | **0** | `npm run lint` |
| Smoke (delivery) | **6/6** | `npm run smoke:render` |
| Locked PDF queue files | **0 diff** | `git diff HEAD -- src/lib/pdfQueueObservability.ts src/lib/pdfQueueMetricsFlush.ts` |

## Count correction (Cycle 3 → Cycle 4)

An older spec line assumed **46** tests after adding briefing coverage; arithmetic against git was wrong.

- At commit `fcceeb3` (last commit **before** `tests/briefingDispatch.test.ts` existed): **45** tests across **8** files.
- `tests/briefingDispatch.test.ts` adds **3** tests → **48** tests, **9** files (**45 + 3 = 48**).

## The “+2” narrative (mapped to files)

Two individual `it()` blocks account for common under-counting vs an informal “43 + 3 briefing = 46” guess:

1. **`tests/api.test.ts`** — gained **+1** test between `97381d4` and `1d78768` (Cycle 2 delivery work); the file now holds **23** cases (billing, PDF export, audit, webhooks, etc.).
2. **`tests/whatsapp.test.ts`** — **4** cases total (three executor paths + **`sendWhatsAppStrict` / HTTP 400**). Docs that only counted three executor tests missed the fourth.

Together with the **3** briefing-dispatch tests, these explain the **48** total without removing any legitimate coverage.

**Status:** Discovered, legitimate, **baselined at 48/48 (9 files)**. Cycle 4+ must not drop below **48** without an explicit defect and stakeholder sign-off.

## Per-file test inventory (current)

| File | Tests (approx.) |
|------|-----------------|
| `tests/api.test.ts` | 23 |
| `tests/briefingDispatch.test.ts` | 3 |
| `tests/circuitBreaker.test.ts` | 2 |
| `tests/mergeAnalyticsEvents.test.ts` | 3 |
| `tests/pdfBranding.test.ts` | 1 |
| `tests/pdfFairPriority.test.ts` | 5 |
| `tests/pdfService.test.ts` | 3 |
| `tests/transcribe.test.ts` | 4 |
| `tests/whatsapp.test.ts` | 4 |

Re-count with: `rg '^\s*it\(' tests -g '*.test.ts'`.
