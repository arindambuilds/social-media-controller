# QuadraPilot

Orchestrated research → prompt → **Stage 4 quality gates** (Prisma generate, `tsc`, lint, Vitest, optional Render smoke).

## Notifications (Cycle 4)

Cycle completion notification is **console-only** by design. Real VS Code toast requires an extension API or task integration. Revisit when QuadraPilot has **≥5 cycles** of proven stability.

**SMOKE_GATE** and other Stage 4 outcomes are emitted on the terminal the same way (no IDE toast unless you add tooling).

## Smoke modes

- **Default (`SMOKE_ENV` unset or `remote`):** Stage 4 runs `npm run smoke:render` against production Render. A formal **cycle delivery report** must show **6/6** from this mode.
- **Offline (`SMOKE_ENV=skip`):** Skips remote smoke so local runs succeed without network. Use **`npm run quadra:offline`** for that. **Never** present a skipped smoke as the delivery gate — always re-run with remote smoke before sign-off.

## Commands

| Script | Purpose |
|--------|---------|
| `npm run quadra` | Full pipeline (research stages + Stage 4 gates). |
| `npm run quadra:offline` | Same, with `SMOKE_ENV=skip` (cross-platform). |
| `npm run quadra:test` / `quadra:verify` | Stage 4 test runner only. |
| `npm run quadra:report` | Regenerate report from last `cycle-*-tests.json`. |
| `npm run quadra:status` | Print persisted cycle state. |

See `TRUTH_TABLE.md` for the authoritative test and smoke baseline.

## First live briefing (Cycle 5)

1. Set **`DEBUG_BRIEFING=1`** on the API + worker processes.
2. Ensure the test **`Client`** row has **`whatsappNumber`** = your **own** E.164 number (Twilio sandbox rules apply).
3. Optional one-shot: **`BRIEFING_E2E_TEST_DELAY_MS=120000`** and **`BRIEFING_E2E_TEST_CLIENT_ID=<your-client-id>`** (fires `runBriefingNow` once after delay). Remove after verification.
4. With Redis off in production, optional **`BRIEFING_CRON_EXPRESSION`** overrides the hourly node-cron pattern for a controlled window (do not leave aggressive crons in prod).
5. Confirm logs: **`[scheduler] Tick fired at:`**, **`[briefing] Claude response length:`**, **`[briefing] Job enqueued…`**, **`[whatsapp] Job picked up`**, **`[whatsapp] Twilio SID:`**.
6. Record SID and physical receipt in **`TRUTH_TABLE.md`** (Cycle 5 table).
