# QuadraPilot

**Smoke test (single source of truth):** Smoke test: 7/7 checks (Health, Login, Analytics, AI Insights, Leads, Gov preview, Posts).

Orchestrated research → prompt → **Stage 4 quality gates** (Prisma generate, `tsc`, lint, Vitest, optional Render smoke).

**Canonical Cycle 3 / Antigravity tech copy** (cron wording, **7/7** smoke, Task 15, migrate phrasing): [`docs/cycle3-antigravity-tech-status.md`](../docs/cycle3-antigravity-tech-status.md) — mirror into Notion / Slack.

## Notifications (Cycle 4)

Cycle completion notification is **console-only** by design. Real VS Code toast requires an extension API or task integration. Revisit when QuadraPilot has **≥5 cycles** of proven stability.

**SMOKE_GATE** and other Stage 4 outcomes are emitted on the terminal the same way (no IDE toast unless you add tooling).

## Smoke modes

- **Default (`SMOKE_ENV` unset or `remote`):** Stage 4 runs `npm run smoke:render` against production Render (override: `npm run smoke:render -- --base https://<api-host>`, or `SMOKE_BASE_URL`). A formal **cycle delivery report** must show **7/7** — same wording as the line above (`scripts/smoke-demo.ts` prints it when green).
- **Offline (`SMOKE_ENV=skip`):** Skips remote smoke so local runs succeed without network. Use **`npm run quadra:offline`** for that. **Never** present a skipped smoke as the delivery gate — always re-run with remote smoke before sign-off.

## Commands

| Script | Purpose |
|--------|---------|
| `npm run quadra` | Full pipeline (research stages + Stage 4 gates). |
| `npm run quadra:offline` | Same, with `SMOKE_ENV=skip` (cross-platform). |
| `npm run quadra:test` / `quadra:verify` | Stage 4 test runner only. |
| `npm run quadra:report` | Regenerate report from last `cycle-*-tests.json`. |
| `npm run quadra:status` | Print persisted cycle state. |

See `TRUTH_TABLE.md` for the authoritative test and smoke baseline. Operator playbook: [`docs/smoke-harness-runbook.md`](../docs/smoke-harness-runbook.md).

**Morning briefing (canonical):** **9:00 Asia/Kolkata** — pattern **`0 9 * * *`**, `tz` / `timezone`: **`Asia/Kolkata`** (not a UTC-only description in stakeholder comms).

## First live briefing — **Cycle 6 blocker C1** (operator only)

Nothing in Cursor replaces this: **watch Render logs and confirm WhatsApp on your phone**. After boot you should see **`[scheduler] Loaded`** once per API process (confirms `scheduleMorningBriefing` module loaded).

1. Set **`DEBUG_BRIEFING=1`** on **API + worker**; same **`REDIS_URL`** on both.
2. **`Client`** row: **`whatsappNumber`** = **your** E.164 (sandbox: recipient must text `join <keyword>` to the sandbox number first).
3. One-shot: **`BRIEFING_E2E_TEST_DELAY_MS=120000`**, **`BRIEFING_E2E_TEST_CLIENT_ID=demo-client`** (or your test id). **Remove both after success** + redeploy.
4. Optional **`BRIEFING_CRON_EXPRESSION`** only when debugging node-cron path (Redis off); do not leave aggressive crons in prod.
5. Log sequence to verify: **`[scheduler] Loaded`** → **`[scheduler] Tick fired at:`** → **`[briefing] Starting…`** → **`[briefing] Claude response length:`** → **`[briefing] Job enqueued…`** → **`[whatsapp] Job picked up…`** → **`[whatsapp] Twilio SID:`**. If Twilio returns an **error**, paste the **exact code** (e.g. 63016, 21211) — check Twilio console **before** changing code.
6. Fill **`TRUTH_TABLE.md`** C1 table (date, SID, phone YES, env cleaned up). **F1–F3 stay deferred until C1 = PASS.**
