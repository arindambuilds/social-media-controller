# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Four Demo Login Bugs
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Bug 1 — Stats route (deterministic):** Make a GET request to `/api/dashboard/stats`; assert HTTP 200 with `DashboardStats` shape. On unfixed code: expect 404 (confirms route is missing)
  - **Bug 2 — Demo user wizard (deterministic):** Run `create-demo-user.ts` against a test DB, query `prisma.user.findUnique({ where: { email: "demo@demo.com" } })`; assert `onboardingCompleted = true`. On unfixed code: expect `false` (confirms flag is never set)
  - **Bug 3 — Seeder throws (deterministic):** Call `seedDemoDataForUser(userId)` for a user with `clientId = null`; assert it completes without throwing. On unfixed code: expect throw `"User or associated client not found"` (confirms hard throw)
  - **Bug 4 — Wrong error message (scoped PBT):** Mock `apiFetch` to throw `new Error("Service temporarily unavailable")`, trigger `handleLogin`; assert `error` state equals `"Service temporarily unavailable"`. On unfixed code: expect `"Invalid email or password"` (confirms catch discards the error)
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: All four tests FAIL (this is correct — it proves each bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Demo Onboarding, Credential Error Message, Seeder Idempotency, Existing Routes
  - **IMPORTANT**: Follow observation-first methodology
  - **Preservation 1 — Non-demo onboarding:** Observe that a user with `email != "demo@demo.com"` and `onboardingCompleted: false` renders `<OnboardingWizard>` on unfixed code; write test asserting this continues to hold
  - **Preservation 2 — Wrong-credential message:** Observe that when `apiFetch` throws with message `"Invalid email or password"` (401), the catch block displays exactly `"Invalid email or password"` on unfixed code; write property-based test: for any error whose `.message` is `"Invalid email or password"`, the displayed message must equal that string
  - **Preservation 3 — Seeder idempotency:** Observe that calling `seedDemoDataForUser` for a user who already has a `DemoData` record returns early without error on unfixed code; write test asserting this still holds
  - **Preservation 4 — Existing dashboard routes:** Observe that `getConversations` and `getDmSettings` succeed for a user with a valid `clientId` on unfixed code; write test asserting these calls still succeed after the stats route is added
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix all four demo login bugs

  - [x] 3.1 Create missing Next.js route handler at `dashboard/app/api/dashboard/stats/route.ts`
    - Create directory `dashboard/app/api/dashboard/stats/`
    - Add `GET` export that reads authenticated user's `clientId` from session token
    - Query `prisma.dmConversation` and `prisma.dmMessage` for stats aggregates
    - Return `isDemoData: true` when `user.hasDemoData = true`
    - Return 401 for unauthenticated requests
    - Response body must conform to `DashboardStats` shape: `totalConversations`, `messagesThisMonth`, `replyRate`, `avgResponseTime`, `recentConversations`, `automationEnabled`, `isDemoData`
    - _Bug_Condition: isBugCondition_1(request) — GET /api/dashboard/stats with no route handler_
    - _Expected_Behavior: response.status = 200 AND response.body conforms to DashboardStats shape_
    - _Preservation: getConversations and getDmSettings calls must still succeed (Requirement 3.4)_
    - _Requirements: 2.1, 3.4_

  - [x] 3.2 Set `onboardingCompleted: true` in `scripts/create-demo-user.ts`
    - Add `onboardingCompleted: true` to the `update` payload of `prisma.user.upsert`
    - Add `onboardingCompleted: true` to the `create` payload of the same upsert
    - _Bug_Condition: isBugCondition_2(user) — demo@demo.com with onboardingCompleted = false after seed_
    - _Expected_Behavior: user.onboardingCompleted = true after any run of create-demo-user.ts_
    - _Preservation: Non-demo users with onboardingCompleted: false must still see OnboardingWizard (Requirement 3.1); script must remain idempotent (Requirement 3.5)_
    - _Requirements: 2.2, 3.1, 3.5_

  - [x] 3.3 Make `seedDemoDataForUser` resilient to missing client in `src/lib/demo-seeder.ts`
    - Replace the hard `throw` when `user.client` is null with a recovery path
    - Use `prisma.client.upsert({ where: { id: "demo-client" }, ... })` to create or retrieve the client
    - Use `prisma.user.update` to set `clientId` on the user if it was null
    - Continue with existing seeding logic using the resolved `clientId`
    - _Bug_Condition: isBugCondition_3(userId) — user exists but user.client = null_
    - _Expected_Behavior: seedDemoDataForUser completes without throwing AND DemoData record is created_
    - _Preservation: Early-return when DemoData already exists must still work (Requirement 3.3)_
    - _Requirements: 2.3, 3.3_

  - [x] 3.4 Thread actual error through login catch block in `dashboard/app/login/page.tsx`
    - Change `catch {` to `catch (err) {`
    - Derive displayed message: `const message = err instanceof Error ? err.message : "Invalid email or password"`
    - Pass `message` to both `setError` and `toast.error` (variables already wired — only the source changes)
    - _Bug_Condition: isBugCondition_4(thrownError) — error.message != "Invalid email or password" thrown by apiFetch_
    - _Expected_Behavior: displayed message = thrownError.message for all non-credential errors_
    - _Preservation: When apiFetch throws "Invalid email or password" (401), catch must still display that exact string (Requirement 3.2)_
    - _Requirements: 2.4, 3.2_

  - [x] 3.5 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Four Demo Login Bugs Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior for all four bugs
    - When all four pass, it confirms the expected behavior is satisfied
    - **EXPECTED OUTCOME**: All four tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm non-demo onboarding, credential error message, seeder idempotency, and existing dashboard routes all behave as before

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm all tests pass
  - Verify the end-to-end demo login flow: run `create-demo-user.ts`, log in as `demo@demo.com`, assert dashboard renders without `<OnboardingWizard>` and stats load without error
  - Verify fresh-deploy seeding: create user without client, call `POST /onboarding/step2`, assert 200 and demo data exists
  - Verify login error flow: simulate 503 from API, assert toast and error state show the correct non-credential message
  - Ask the user if any questions arise
