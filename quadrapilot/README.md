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
