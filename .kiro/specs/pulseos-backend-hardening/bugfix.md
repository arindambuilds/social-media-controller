# Bugfix Requirements Document

## Introduction

The PulseOS backend has accumulated a set of non-critical but production-relevant defects across four areas: test suite reliability, frontend ESLint hygiene, deployment configuration correctness, and schema integrity. Left unaddressed these issues erode CI confidence, introduce dead code paths, risk misconfigured multi-service deploys, and leave an unreviewed schema change in the codebase. This document captures the current defective behaviors, the expected correct behaviors, and the existing behaviors that must not regress.

---

## Bug Analysis

### Current Behavior (Defect)

**Test Suite**

1.1 WHEN the full backend test suite is run THEN 9 integration tests in `tests/api.test.ts` fail because the test environment points to a local Postgres instance that is not available, producing connection-refused errors rather than clean skips.

1.2 WHEN `vitest` resolves `@/` path aliases in test files THEN some test files fail with module-not-found errors because the alias was missing from `vitest.config.ts` (partially fixed; may still affect edge cases).

**ESLint Warnings**

1.3 WHEN ESLint runs against `dashboard/app/campaigns/page.tsx` THEN it reports `'useAuth' is declared but its value is never read` and `'router' is declared but its value is never read`.

1.4 WHEN ESLint runs against analytics, insights, onboarding, and settings components THEN it reports non-blocking warnings (unused variables, missing dependency array entries, or similar) that accumulate noise in CI output.

**render.yaml**

1.5 WHEN `render.yaml` is parsed by the Render platform THEN the three services (`social-media-controller`, `pulse-whatsapp-ingress-worker`, `pulse-whatsapp-outbound-worker`) each duplicate the full environment variable block verbatim, creating a maintenance hazard where a key updated in one service is silently missed in the others.

1.6 WHEN the worker services in `render.yaml` are deployed THEN they run `npm install && npm run build` independently, meaning a build failure in one service does not surface until that specific service is deployed rather than at a single shared build step.

**Prisma Schema**

1.7 WHEN `prisma/schema.prisma` is reviewed THEN a pre-existing change (addition of `AnalyticsEvent` model and `JobLog` model) is present without a corresponding migration audit note, leaving it unclear whether `prisma migrate deploy` has been run against production and whether the migration is idempotent.

---

### Expected Behavior (Correct)

**Test Suite**

2.1 WHEN the full backend test suite is run without a local Postgres instance THEN the system SHALL skip all integration tests cleanly (zero failures, zero errors) and report only the 115 passing unit tests.

2.2 WHEN `vitest` resolves `@/` path aliases THEN the system SHALL resolve all aliases correctly for every test file without module-not-found errors.

**ESLint Warnings**

2.3 WHEN ESLint runs against `dashboard/app/campaigns/page.tsx` THEN the system SHALL report zero warnings by removing the unused `useAuth` import and the unused `router` variable.

2.4 WHEN ESLint runs against analytics, insights, onboarding, and settings components THEN the system SHALL report zero non-blocking warnings, with all unused imports and variables removed or suppressed with an inline justification comment.

**render.yaml**

2.5 WHEN `render.yaml` is reviewed THEN the system SHALL have a single authoritative environment variable block (or clearly documented shared reference) so that adding or rotating a secret requires editing exactly one location.

2.6 WHEN the worker services in `render.yaml` are deployed THEN each service SHALL declare only the environment variables it actually consumes, reducing the blast radius of a misconfigured secret.

**Prisma Schema**

2.7 WHEN `prisma/schema.prisma` is audited THEN the system SHALL have a documented confirmation that the `AnalyticsEvent` and `JobLog` models have a corresponding migration file and that `prisma migrate deploy` has been verified against the production database, or a remediation note is recorded.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the 115 existing unit tests are run THEN the system SHALL CONTINUE TO pass all 115 tests without modification.

3.2 WHEN the dashboard Next.js build (`npm run build`) is run THEN the system SHALL CONTINUE TO complete with zero TypeScript errors and zero build failures.

3.3 WHEN the backend TypeScript compiler check (`npx tsc --noEmit`) is run THEN the system SHALL CONTINUE TO report zero errors.

3.4 WHEN the `social-media-controller` web service is deployed via `render.yaml` THEN the system SHALL CONTINUE TO run `npx prisma migrate deploy && node dist/index.js` as its start command and expose `/api/health` as the health check path.

3.5 WHEN the `pulse-whatsapp-ingress-worker` and `pulse-whatsapp-outbound-worker` services are deployed THEN the system SHALL CONTINUE TO start their respective worker entry points (`dist/workers/whatsappIngressWorkerEntry.js` and `dist/workers/whatsappOutboundWorkerEntry.js`).

3.6 WHEN the Prisma client is generated THEN the system SHALL CONTINUE TO use the pooled `DATABASE_URL` for runtime queries and the direct `DIRECT_URL` for migrations.

3.7 WHEN existing dashboard pages (campaigns, analytics, insights, onboarding, settings) are rendered THEN the system SHALL CONTINUE TO function identically from the user's perspective after ESLint cleanup — no runtime behavior changes.
