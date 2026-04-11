# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Backend Hardening Defects
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each defect exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility
  - Test 1.1: Run `vitest --run` without a local Postgres instance and assert zero test failures (currently 9 integration tests fail with connection-refused errors)
  - Test 1.3: Run ESLint against `dashboard/app/campaigns/page.tsx` and assert zero warnings (currently reports `useAuth` and `router` declared but never read)
  - Test 1.4: Run ESLint against analytics, insights, onboarding, and settings components and assert zero warnings (currently accumulates non-blocking noise)
  - Test 1.5: Parse `render.yaml` and assert each service declares only the env vars it actually consumes — no full-block duplication across services
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "9 integration tests fail with ECONNREFUSED", "ESLint reports 2 unused-var warnings in campaigns/page.tsx")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Passing Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `vitest --run` currently passes 115 unit tests on unfixed code — record that count
  - Observe: `npm run build` in `dashboard/` completes with zero TypeScript errors on unfixed code
  - Observe: `npx tsc --noEmit` in the backend reports zero errors on unfixed code
  - Observe: `render.yaml` `social-media-controller` start command is `npx prisma migrate deploy && node dist/index.js` and health check path is `/api/health`
  - Observe: worker start commands reference `dist/workers/whatsappIngressWorkerEntry.js` and `dist/workers/whatsappOutboundWorkerEntry.js`
  - Observe: Prisma schema uses `DATABASE_URL` for runtime and `DIRECT_URL` for migrations
  - Write property-based tests: for all runs of the unit suite, passing count >= 115; for all ESLint-cleaned pages, runtime behavior is unchanged
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix PulseOS backend hardening defects

  - [x] 3.1 Fix integration test environment — skip tests when Postgres is unavailable
    - In `tests/api.test.ts`, add a `beforeAll` guard that checks for a live DB connection and calls `vi.skip()` (or equivalent) on the entire integration suite when the connection is refused
    - Ensure the 9 failing integration tests are skipped cleanly rather than erroring
    - Verify `vitest --run` exits with zero failures when no local Postgres is present
    - _Bug_Condition: isBugCondition(env) where env.POSTGRES_AVAILABLE = false_
    - _Expected_Behavior: zero failures, zero errors; only 115 unit tests reported_
    - _Preservation: 115 existing unit tests continue to pass (3.1)_
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.2 Verify / fix `@/` path alias in `vitest.config.ts`
    - Confirm `resolve.alias` in `vitest.config.ts` maps `@/` to the correct source root
    - Run a representative test file that uses `@/` imports and assert no module-not-found errors
    - _Bug_Condition: isBugCondition(testFile) where testFile uses `@/` alias and alias is missing_
    - _Expected_Behavior: all aliases resolve without module-not-found errors_
    - _Preservation: existing passing tests unaffected (3.1, 3.3)_
    - _Requirements: 1.2, 2.2, 3.1_

  - [x] 3.3 Remove unused `useAuth` import and `router` variable from campaigns page
    - In `dashboard/app/campaigns/page.tsx`, delete the `useAuth` import line
    - Delete or inline the unused `router` variable declaration
    - Re-run ESLint on the file and confirm zero warnings
    - _Bug_Condition: isBugCondition(file) where file = campaigns/page.tsx AND unused vars present_
    - _Expected_Behavior: ESLint reports zero warnings for campaigns/page.tsx_
    - _Preservation: page renders and functions identically at runtime (3.7)_
    - _Requirements: 1.3, 2.3, 3.7_

  - [x] 3.4 Clean ESLint warnings in analytics, insights, onboarding, and settings components
    - Remove or suppress (with inline justification comment) all unused imports and variables in the affected components
    - Re-run ESLint across the dashboard and confirm zero non-blocking warnings remain
    - _Bug_Condition: isBugCondition(component) where component ∈ {analytics, insights, onboarding, settings} AND ESLint warnings > 0_
    - _Expected_Behavior: ESLint reports zero non-blocking warnings across all dashboard components_
    - _Preservation: all affected pages continue to render and function identically (3.2, 3.7)_
    - _Requirements: 1.4, 2.4, 3.2, 3.7_

  - [x] 3.5 Refactor `render.yaml` to eliminate duplicated environment variable blocks
    - Audit all env var keys across the three services (`social-media-controller`, `pulse-whatsapp-ingress-worker`, `pulse-whatsapp-outbound-worker`)
    - Remove env vars from each worker service that it does not actually consume
    - Document the authoritative shared set vs. service-specific vars (comment block or YAML anchor)
    - Verify `social-media-controller` still declares `npx prisma migrate deploy && node dist/index.js` as start command and `/api/health` as health check path
    - Verify worker start commands still reference the correct entry point files
    - _Bug_Condition: isBugCondition(yaml) where full env block is duplicated verbatim across services_
    - _Expected_Behavior: each service declares only the env vars it consumes; single authoritative source_
    - _Preservation: all three services deploy with correct start commands and health checks (3.4, 3.5, 3.6)_
    - _Requirements: 1.5, 1.6, 2.5, 2.6, 3.4, 3.5, 3.6_

  - [x] 3.6 Audit and document Prisma schema migration status
    - Confirm a migration file exists in `prisma/migrations/` that covers the `AnalyticsEvent` and `JobLog` model additions
    - If the migration file is missing, generate it with `prisma migrate dev --name add_analytics_event_job_log` in a non-production environment
    - Record a confirmation note (inline comment in `schema.prisma` or a `MIGRATION_AUDIT.md` entry) that `prisma migrate deploy` has been verified against production, or document the remediation steps required
    - Verify Prisma client generation still uses `DATABASE_URL` for runtime and `DIRECT_URL` for migrations
    - _Bug_Condition: isBugCondition(schema) where AnalyticsEvent/JobLog models exist without migration audit note_
    - _Expected_Behavior: migration file confirmed present; audit note recorded_
    - _Preservation: Prisma client generation unchanged; DATABASE_URL/DIRECT_URL config intact (3.6)_
    - _Requirements: 1.7, 2.7, 3.6_

  - [x] 3.7 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Backend Hardening Defects Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - Run `vitest --run` without Postgres and assert zero failures
    - Run ESLint on campaigns/page.tsx and assert zero warnings
    - Run ESLint across dashboard and assert zero non-blocking warnings
    - Parse `render.yaml` and assert no duplicated full env blocks
    - **EXPECTED OUTCOME**: All exploration tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `vitest --run` and confirm all 115 unit tests still pass
    - Run `npm run build` in `dashboard/` and confirm zero TypeScript errors
    - Run `npx tsc --noEmit` in backend and confirm zero errors
    - Confirm `render.yaml` service start commands and health check paths are unchanged
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite (`vitest --run`) and confirm 115 unit tests pass, 0 failures
  - Run ESLint across the dashboard and confirm 0 warnings
  - Run `npm run build` in `dashboard/` and confirm 0 errors
  - Run `npx tsc --noEmit` in the backend and confirm 0 errors
  - Review `render.yaml` one final time to confirm no duplicated env blocks and correct start commands
  - Confirm Prisma migration audit note is present
  - Ask the user if any questions arise before closing the spec
