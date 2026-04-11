# Bugfix Requirements Document

## Introduction

PulseOS has four interconnected bugs that collectively break the demo login experience and degrade production reliability. A demo user logging in with `demo@demo.com` hits a 404 on the dashboard stats endpoint, is immediately blocked by the OnboardingWizard (which they can never dismiss cleanly), and if they attempt to proceed through onboarding, step 2 throws a 500 because the demo seeder requires a linked client that may not exist on a fresh deploy. Separately, all login failures — whether caused by bad credentials, a database outage, or a rate limit — surface the same misleading "Invalid email or password" message, hiding real infrastructure problems from users and operators.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the dashboard page loads and calls `GET /api/dashboard/stats` THEN the system returns a 404 because no Next.js route handler exists at `dashboard/app/api/dashboard/stats/`, causing `loadError` to be set and stats to never render.

1.2 WHEN a demo user (`onboardingCompleted: false`) logs in THEN the system renders the `<OnboardingWizard>` overlay blocking the entire dashboard, because `create-demo-user.ts` never sets `onboardingCompleted: true` on the seeded user.

1.3 WHEN the OnboardingWizard reaches step 2 and calls `POST /onboarding/step2` for the demo user THEN the system returns a 500 error with "Failed to seed demo data", because `seedDemoDataForUser` throws "User or associated client not found" when the `demo-client` record does not exist in the current database (e.g. fresh deploy where only the user was upserted but the client upsert failed or was skipped).

1.4 WHEN a login attempt fails for any reason other than wrong credentials (e.g. database unavailable returning 503, network timeout, or rate limit returning 429) THEN the system displays "Invalid email or password" because the `catch` block in `LoginPage.handleLogin` ignores the actual error and always uses that hardcoded string.

### Expected Behavior (Correct)

2.1 WHEN the dashboard page loads and calls `GET /api/dashboard/stats` THEN the system SHALL return a 200 response with a valid `DashboardStats` JSON payload from a Next.js route handler at `dashboard/app/api/dashboard/stats/route.ts`.

2.2 WHEN a demo user logs in THEN the system SHALL render the dashboard directly without showing the `<OnboardingWizard>`, because the demo seed script SHALL set `onboardingCompleted: true` on the demo user record.

2.3 WHEN `POST /onboarding/step2` is called for the demo user on a fresh deploy THEN the system SHALL complete successfully, because `seedDemoDataForUser` SHALL verify the client record exists (or create it) before attempting to seed conversations and reports.

2.4 WHEN a login attempt fails due to a non-credential error THEN the system SHALL display an error message that reflects the actual failure category — "Service temporarily unavailable" for 503 responses, "Request timed out" for network timeouts, and "Too many attempts — please wait" for 429 responses — rather than always showing "Invalid email or password".

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a regular (non-demo) user with `onboardingCompleted: false` logs in THEN the system SHALL CONTINUE TO show the `<OnboardingWizard>` so that real users still complete onboarding.

3.2 WHEN a login attempt fails due to genuinely wrong credentials (401 with `UNAUTHORIZED` code) THEN the system SHALL CONTINUE TO display "Invalid email or password".

3.3 WHEN `seedDemoDataForUser` is called for a user who already has demo data THEN the system SHALL CONTINUE TO skip seeding and return early without error.

3.4 WHEN the dashboard page loads for a user with a valid `clientId` THEN the system SHALL CONTINUE TO fetch conversations and DM settings from the existing API routes alongside the new stats route.

3.5 WHEN `create-demo-user.ts` is run multiple times against the same database THEN the system SHALL CONTINUE TO be idempotent — no duplicate users, clients, or errors on re-run.
