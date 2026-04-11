# Demo Login Production Readiness — Bugfix Design

## Overview

Four bugs collectively break the demo login experience and degrade production reliability. A demo user logging in with `demo@demo.com` hits a 404 on the dashboard stats endpoint, is immediately blocked by the OnboardingWizard they can never dismiss, and if they proceed through onboarding, step 2 throws a 500 because the seeder requires a linked client that may not exist on a fresh deploy. Separately, all login failures — wrong credentials, database outage, rate limit — surface the same misleading "Invalid email or password" message.

The fix strategy is minimal and targeted: add the missing Next.js route handler, set `onboardingCompleted: true` in the seed script, make `seedDemoDataForUser` resilient to a missing client, and thread the actual error message through the login catch block.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs or states that trigger a defect
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing correct behaviors that must remain unchanged after the fix
- **`seedDemoDataForUser`**: Function in `src/lib/demo-seeder.ts` that creates demo conversations, messages, and reports for a given userId
- **`create-demo-user.ts`**: Script in `scripts/create-demo-user.ts` that upserts the `demo@demo.com` user and `demo-client` record
- **`handleLogin`**: Async form handler in `dashboard/app/login/page.tsx` that calls `apiFetch("/auth/login", ...)` and sets session or error state
- **`fetchDashboardStats`**: Callback in `dashboard/app/dashboard/page.tsx` that calls `fetch("/api/dashboard/stats")` — a Next.js internal route
- **`onboardingCompleted`**: Boolean field on the `User` model; when `false`, `DashboardPage` renders `<OnboardingWizard>`

---

## Bug Details

### Bug 1 — Missing `/api/dashboard/stats` Route Handler

The dashboard page calls `fetch("/api/dashboard/stats")` (a Next.js App Router internal route), but no `route.ts` file exists at `dashboard/app/api/dashboard/stats/`. Next.js returns a 404, `fetchDashboardStats` sets `loadError`, and stats never render.

**Formal Specification:**
```
FUNCTION isBugCondition_1(request)
  INPUT: request of type NextRequest
  OUTPUT: boolean

  RETURN request.method = "GET"
         AND request.path = "/api/dashboard/stats"
         AND routeHandlerExists("/api/dashboard/stats") = false
END FUNCTION
```

**Examples:**
- Dashboard loads → `fetch("/api/dashboard/stats")` → 404 → `loadError = "Failed to load stats"` → stat cards never render
- Demo user, real user, any authenticated user — all hit the same 404

---

### Bug 2 — Demo User Always Sees OnboardingWizard

`create-demo-user.ts` upserts the demo user without setting `onboardingCompleted: true`. `DashboardPage` renders `<OnboardingWizard>` whenever `!user.onboardingCompleted`, so the demo user is immediately blocked by the wizard on every login.

**Formal Specification:**
```
FUNCTION isBugCondition_2(user)
  INPUT: user of type User
  OUTPUT: boolean

  RETURN user.email = "demo@demo.com"
         AND user.onboardingCompleted = false
         AND user was created by create-demo-user.ts
END FUNCTION
```

**Examples:**
- `demo@demo.com` logs in → `user.onboardingCompleted = false` → `<OnboardingWizard>` renders, blocking dashboard
- Re-running `create-demo-user.ts` (upsert path) → still does not set `onboardingCompleted: true` → same result

---

### Bug 3 — `seedDemoDataForUser` Throws on Fresh Deploy

`seedDemoDataForUser` fetches the user with `include: { client: true }` and throws `"User or associated client not found"` if `user.client` is null. On a fresh deploy, if the `demo-client` record was not yet created (or the user was not yet linked), step 2 of onboarding returns a 500.

**Formal Specification:**
```
FUNCTION isBugCondition_3(userId)
  INPUT: userId of type string
  OUTPUT: boolean

  user := prisma.user.findUnique({ where: { id: userId }, include: { client: true } })
  RETURN user != null
         AND user.client = null
END FUNCTION
```

**Examples:**
- Fresh deploy: `create-demo-user.ts` upserts user, client upsert fails or is skipped → `user.client = null` → seeder throws → `POST /onboarding/step2` returns 500
- Any user whose `clientId` is null (e.g. partially created account) → same throw

---

### Bug 4 — Login Catch Block Always Shows Wrong Error

The `catch` block in `handleLogin` ignores the thrown `Error` object entirely and hardcodes `"Invalid email or password"`. `apiFetch` already produces descriptive messages (`friendlyHttpMessage` in `api.ts` maps 429, 5xx, timeouts), but they are discarded.

**Formal Specification:**
```
FUNCTION isBugCondition_4(thrownError)
  INPUT: thrownError of type Error
  OUTPUT: boolean

  RETURN thrownError.message != "Invalid email or password"
         AND thrownError was thrown by apiFetch("/auth/login", ...)
END FUNCTION
```

**Examples:**
- API returns 503 → `apiFetch` throws `"Something went sideways — let's try again."` → catch shows `"Invalid email or password"` ✗
- Network timeout → `apiFetch` throws `"The API is taking a little longer than usual."` → catch shows `"Invalid email or password"` ✗
- API returns 429 → `apiFetch` throws `"You've made a lot of requests."` → catch shows `"Invalid email or password"` ✗
- API returns 401 wrong credentials → `apiFetch` throws `"Invalid email or password"` → catch shows `"Invalid email or password"` ✓ (not a bug case)

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- A regular (non-demo) user with `onboardingCompleted: false` MUST still see `<OnboardingWizard>` on login
- A login failure due to wrong credentials (401) MUST still display "Invalid email or password"
- `seedDemoDataForUser` called for a user who already has demo data MUST still skip seeding and return early
- The dashboard page MUST still fetch conversations and DM settings from existing API routes alongside the new stats route
- Running `create-demo-user.ts` multiple times MUST remain idempotent — no duplicate users, clients, or errors

**Scope:**
All inputs that do NOT match the four bug conditions above should be completely unaffected. This includes:
- Non-demo users going through normal onboarding
- Successful logins
- Dashboard data fetching via existing workspace API routes
- Any user with a properly linked client record calling `seedDemoDataForUser`

---

## Hypothesized Root Cause

**Bug 1 — Missing route handler:**
The `dashboard/app/api/` directory exists but is empty. The developer added the `fetchDashboardStats` call in `page.tsx` without creating the corresponding `route.ts` file. Next.js App Router requires a `route.ts` (or `route.js`) file to handle API requests.

**Bug 2 — Demo user sees wizard:**
`create-demo-user.ts` was written to create a minimal user record and never included `onboardingCompleted: true` in either the `create` or `update` payload. The wizard condition `!user.onboardingCompleted` is correct for real users; the seed script simply omits the flag.

**Bug 3 — Seeder throws on missing client:**
`seedDemoDataForUser` was designed assuming the user always has a linked client. The guard `if (!user || !user.client) { throw new Error(...) }` is a hard failure with no recovery path. On a fresh deploy, the user may exist without a client if `create-demo-user.ts` hasn't been run yet, or if the client upsert step failed silently.

**Bug 4 — Wrong error message:**
The `catch` block was written as `catch { const message = "Invalid email or password"; ... }` — the caught error is never bound to a variable. The developer likely copy-pasted a credential-error handler and forgot to thread the actual error message through. `apiFetch` already produces the correct user-facing message via `friendlyHttpMessage`; it just needs to be used.

---

## Correctness Properties

Property 1: Bug Condition — Stats Route Returns Valid Payload

_For any_ authenticated GET request to `/api/dashboard/stats`, the fixed Next.js route handler SHALL return HTTP 200 with a JSON body conforming to the `DashboardStats` shape (fields: `totalConversations`, `messagesThisMonth`, `replyRate`, `avgResponseTime`, `recentConversations`, `automationEnabled`, `isDemoData`).

**Validates: Requirements 2.1**

Property 2: Bug Condition — Demo User Skips OnboardingWizard

_For any_ user record created or updated by `create-demo-user.ts`, the resulting database row SHALL have `onboardingCompleted = true`, so that `DashboardPage` does not render `<OnboardingWizard>` for that user.

**Validates: Requirements 2.2, 3.1**

Property 3: Bug Condition — Seeder Tolerates Missing Client

_For any_ call to `seedDemoDataForUser(userId)` where the user exists in the database but has no linked client record, the fixed function SHALL complete successfully by creating or linking the `demo-client` record rather than throwing.

**Validates: Requirements 2.3, 3.3**

Property 4: Bug Condition — Login Displays Correct Error Category

_For any_ error thrown by `apiFetch("/auth/login", ...)`, the fixed `handleLogin` catch block SHALL display the error message from the thrown `Error` object rather than the hardcoded string `"Invalid email or password"`.

**Validates: Requirements 2.4, 3.2**

Property 5: Preservation — Non-Demo Onboarding Unchanged

_For any_ user where `isBugCondition_2` does NOT hold (i.e. not the demo user, or `onboardingCompleted` is already `false` for a real user), the dashboard SHALL continue to render `<OnboardingWizard>` when `onboardingCompleted` is `false`, preserving the real-user onboarding flow.

**Validates: Requirements 3.1**

Property 6: Preservation — Wrong-Credential Message Unchanged

_For any_ login failure where `apiFetch` throws with message `"Invalid email or password"` (i.e. a genuine 401 wrong-credentials response), the fixed catch block SHALL still display `"Invalid email or password"`, preserving the existing credential-error UX.

**Validates: Requirements 3.2**

---

## Fix Implementation

### Bug 1 — Create `/api/dashboard/stats/route.ts`

**File:** `dashboard/app/api/dashboard/stats/route.ts` (new file)

**Changes:**
1. Create the directory `dashboard/app/api/dashboard/stats/`
2. Add a `GET` export that reads the authenticated user's `clientId` from the session token, queries `prisma.dmConversation` and `prisma.dmMessage` for stats, and returns a `DashboardStats` JSON response
3. Return `isDemoData: true` when the user has `hasDemoData: true`
4. Return 401 if no valid session is present

---

### Bug 2 — Set `onboardingCompleted: true` in seed script

**File:** `scripts/create-demo-user.ts`

**Changes:**
1. Add `onboardingCompleted: true` to the `update` payload of the `prisma.user.upsert` call
2. Add `onboardingCompleted: true` to the `create` payload of the same upsert

---

### Bug 3 — Make seeder resilient to missing client

**File:** `src/lib/demo-seeder.ts`

**Changes:**
1. Replace the hard `throw` when `user.client` is null with a recovery path: upsert the `demo-client` record and link it to the user before proceeding
2. Use `prisma.client.upsert` with `where: { id: "demo-client" }` to create or retrieve the client
3. Use `prisma.user.update` to set `clientId` on the user if it was null
4. Continue with the existing seeding logic using the resolved `clientId`

---

### Bug 4 — Thread actual error through login catch block

**File:** `dashboard/app/login/page.tsx`

**Changes:**
1. Change `catch {` to `catch (err) {`
2. Derive the displayed message from the caught error: `const message = err instanceof Error ? err.message : "Invalid email or password"`
3. Pass `message` to both `setError` and `toast.error` (already done — just needs the variable to be populated correctly)

---

## Testing Strategy

### Validation Approach

Two-phase approach: first surface counterexamples on unfixed code to confirm root cause, then verify the fix and run preservation checks.

---

### Exploratory Bug Condition Checking

**Goal:** Demonstrate each bug on unfixed code before implementing the fix.

**Bug 1 — Stats route:**
- Make a GET request to `/api/dashboard/stats` on the unfixed codebase
- Expected: 404 Not Found (confirms the route is missing)

**Bug 2 — Demo user wizard:**
- Run `create-demo-user.ts` against a test database, then query `prisma.user.findUnique({ where: { email: "demo@demo.com" } })`
- Expected: `onboardingCompleted = false` (confirms the flag is never set)

**Bug 3 — Seeder throws:**
- Call `seedDemoDataForUser(userId)` for a user with `clientId = null`
- Expected: throws `"User or associated client not found"` (confirms the hard throw)

**Bug 4 — Wrong error message:**
- Mock `apiFetch` to throw `new Error("Service temporarily unavailable")`, trigger `handleLogin`
- Expected: `error` state is set to `"Invalid email or password"` instead of the actual message (confirms the catch discards the error)

---

### Fix Checking

**Goal:** Verify that for all inputs where each bug condition holds, the fixed code produces the expected behavior.

**Pseudocode (general):**
```
FOR ALL input WHERE isBugCondition_N(input) DO
  result := fixedCode(input)
  ASSERT property_N(result)
END FOR
```

**Bug 1:**
```
FOR ALL authenticated GET /api/dashboard/stats requests DO
  response := routeHandler(request)
  ASSERT response.status = 200
  ASSERT response.body conforms to DashboardStats shape
END FOR
```

**Bug 2:**
```
FOR ALL runs of create-demo-user.ts DO
  user := prisma.user.findUnique({ where: { email: "demo@demo.com" } })
  ASSERT user.onboardingCompleted = true
END FOR
```

**Bug 3:**
```
FOR ALL userId WHERE user.client = null DO
  result := seedDemoDataForUser_fixed(userId)
  ASSERT result does not throw
  ASSERT prisma.demoData.findUnique({ where: { userId } }) != null
END FOR
```

**Bug 4:**
```
FOR ALL errors thrown by apiFetch WHERE error.message != "Invalid email or password" DO
  displayedMessage := handleLogin_fixed(triggerError(error))
  ASSERT displayedMessage = error.message
END FOR
```

---

### Preservation Checking

**Goal:** Verify that inputs outside each bug condition produce the same behavior as before.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_N(input) DO
  ASSERT original_behavior(input) = fixed_behavior(input)
END FOR
```

**Property-based testing is recommended** for Bug 4 preservation because the space of possible error messages is large and PBT can generate many variants automatically.

**Test Cases:**
1. **Non-demo user onboarding (Bug 2 preservation):** A user with `email != "demo@demo.com"` and `onboardingCompleted: false` must still see `<OnboardingWizard>`
2. **Wrong-credential message (Bug 4 preservation):** When `apiFetch` throws with message `"Invalid email or password"`, the catch block must display exactly that string
3. **Seeder idempotency (Bug 3 preservation):** Calling `seedDemoDataForUser` for a user who already has `DemoData` must still return early without error
4. **Existing dashboard routes (Bug 1 preservation):** `getConversations` and `getDmSettings` calls must still succeed after adding the new stats route

---

### Unit Tests

- GET `/api/dashboard/stats` returns 200 with correct shape for authenticated user
- GET `/api/dashboard/stats` returns 401 for unauthenticated request
- `create-demo-user.ts` sets `onboardingCompleted: true` on both create and update paths
- `seedDemoDataForUser` completes without throwing when user has no linked client
- `seedDemoDataForUser` skips seeding when `DemoData` record already exists
- `handleLogin` displays the error message from the thrown Error for 503, 429, and timeout cases
- `handleLogin` displays "Invalid email or password" for 401 wrong-credentials

### Property-Based Tests

- For any HTTP error status thrown by a mocked `apiFetch`, `handleLogin` displays the message from the thrown Error (not a hardcoded string)
- For any userId where `user.client` is null, `seedDemoDataForUser` completes without throwing and creates a `DemoData` record
- For any authenticated user with a valid `clientId`, GET `/api/dashboard/stats` returns a response where all numeric fields are non-negative

### Integration Tests

- Full demo login flow: run `create-demo-user.ts`, log in as `demo@demo.com`, assert dashboard renders without `<OnboardingWizard>` and stats load without error
- Fresh-deploy seeding: create user without client, call `POST /onboarding/step2`, assert 200 and demo data exists
- Login error flow: simulate 503 from API, assert toast and error state show the correct non-credential message
