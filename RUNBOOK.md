# RUNBOOK

## Local Runbook

### Running the App Locally (Customer View)

#### Prerequisites

- Node.js 22.x to match the project Docker image
- npm
- Docker Desktop, or a local Postgres 16 instance plus Redis 7

#### Required env vars

Backend file: `.env`

- `NODE_ENV=development`
- `PORT=4000`
- `APP_BASE_URL=http://localhost:4000`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/social_media_controller?schema=public`
- `DIRECT_URL=postgresql://postgres:postgres@localhost:5432/social_media_controller?schema=public`
- `JWT_SECRET=<32+ char secret>`
- `JWT_REFRESH_SECRET=<32+ char secret>`
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `AUTH_HTTPONLY_COOKIES=true`
- `CORS_ORIGIN=http://localhost:3000`
- `INGESTION_MODE=mock`

Dashboard file: `dashboard/.env.local`

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`
- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3000`
- `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI=http://localhost:3000/onboarding/callback`
- `NEXT_PUBLIC_ENABLE_MOCK_BILLING=true`

Optional local Razorpay sandbox vars if you want a real test modal instead of the default mock flow:

- `RAZORPAY_KEY_ID=<rzp_test_...>`
- `RAZORPAY_KEY_SECRET=<test secret>`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID=<rzp_test_...>`

#### Setup

1. Install backend dependencies:

   ```bash
   npm install
   ```

2. Install dashboard dependencies:

   ```bash
   npm --prefix dashboard install
   ```

3. Copy and fill env files:

   ```bash
   copy .env.example .env
   copy dashboard\.env.local.example dashboard\.env.local
   ```

4. Start local infrastructure:

   ```bash
   docker compose up -d postgres redis
   ```

5. Run database migrations:

   ```bash
   npm run prisma:migrate
   ```

6. Seed demo data and login users:

   ```bash
   npm run prisma:seed
   ```

   Primary local login:

   - `demo@demo.com`
   - `Demo1234!`

   Alternate local logins:

   - `demo@agencyname.com` / `Demo1234!`
   - `admin@demo.com` / `admin123`
   - `salon@pilot.demo` / `pilot123`

#### Start the app

Use two commands total:

1. Infra:

   ```bash
   docker compose up -d postgres redis
   ```

2. App servers:

   ```bash
   npm run dev:all
   ```

This starts:

- Backend on `http://localhost:4000`
- Dashboard on `http://localhost:3000`

#### Customer Session - URLs to open

- Login: `http://localhost:3000/login`
- Dashboard home: `http://localhost:3000/dashboard`
- Analytics overview: `http://localhost:3000/analytics`
- Growth funnel page: `http://localhost:3000/dashboard/analytics`
- Leads: `http://localhost:3000/leads`
- Posts: `http://localhost:3000/posts`
- Billing / checkout: `http://localhost:3000/billing`
- Success page example: `http://localhost:3000/success?razorpay_payment_id=test_local_payment`

#### Verifying billing locally

Default local mode is mocked on purpose.

1. Confirm `NEXT_PUBLIC_ENABLE_MOCK_BILLING=true` in `dashboard/.env.local`.
2. Leave Razorpay keys empty.
3. Open `http://localhost:3000/billing`.
4. Click `Complete local test checkout`.
5. Confirm the browser prompt.
6. Expected result:
   - the dashboard calls `/api/verify-payment`
   - the dashboard API activates the plan through backend `POST /api/billing/activate`
   - you are redirected to `/success?razorpay_payment_id=mock_payment_...`

If you want real Razorpay sandbox locally instead of the mock flow:

1. Set `NEXT_PUBLIC_ENABLE_MOCK_BILLING=false`.
2. Fill `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID` in `dashboard/.env.local`.
3. Restart `npm run dev:all`.
4. Open `http://localhost:3000/billing` and use Razorpay test mode.

#### Health check

Backend:

```bash
curl http://localhost:4000/api/health
```

Expected response shape:

```json
{
  "status": "ok",
  "timestamp": "2026-04-05T00:00:00.000Z",
  "environment": "development"
}
```

Useful extra probe:

```bash
curl http://localhost:4000/api/health?deps=1
```

#### Known local notes

- `http://localhost:3000/analytics` uses real backend analytics endpoints.
- `http://localhost:3000/dashboard/analytics` is currently a safe stub and should show `Funnel analytics coming soon`.
- `dashboard/utils/analytics.ts` still POSTs browser events to `/api/analytics`, while the current route is GET-only. This does not block the customer flow, but event ingestion is intentionally limited for now.

## Cloud Runbook

### Deploying to Render + Vercel (Customer View)

#### Backend (Render)

Recommended service type: Render Web Service

- Root directory: repo root `/`
- Build command: `npm ci && npx prisma generate && npm run build`
- Start command: `npx prisma migrate deploy && node dist/index.js`
- Health check path: `/api/health`

Optional worker services from `render.yaml` for WhatsApp queue processing:

- `pulse-whatsapp-ingress-worker`
- `pulse-whatsapp-outbound-worker`

Use the same env set on the workers as the web service.

Required backend env vars for a customer-ready deployment:

| Variable | Example | Why it matters |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production behavior |
| `DATABASE_URL` | `postgresql://...:6543/...` | Runtime Prisma connection |
| `DIRECT_URL` | `postgresql://...:5432/...` | Prisma migrate / direct access |
| `JWT_SECRET` | `<32+ chars>` | Access token signing |
| `JWT_REFRESH_SECRET` | `<32+ chars>` | Refresh token signing |
| `APP_BASE_URL` | `https://social-media-controller.onrender.com` | Canonical backend URL |
| `DASHBOARD_URL` | `https://social-media-controller.vercel.app` | Links and billing return targets |
| `CORS_ORIGIN` | `https://social-media-controller.vercel.app` | Credentialed browser access |
| `AUTH_HTTPONLY_COOKIES` | `true` | Cross-origin session restore |
| `REDIS_URL` | `rediss://...` | Queue workers, Redis-backed features |

Feature-specific backend env vars for customer-facing integrations:

| Variable group | Examples |
| --- | --- |
| Instagram / Meta OAuth | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_FRONTEND_REDIRECT_URI` |
| LinkedIn OAuth | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| WhatsApp Cloud API | `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN` |
| AI features | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BRIEFING_MODEL`, `ANTHROPIC_VOICE_MODEL` |
| Email delivery | `POSTMARK_API_TOKEN` or `SMTP_*` or `AWS_SES_*` |

For a fast cloud smoke path without social credentials, keep:

- `INGESTION_MODE=mock`
- only the core auth/db/cors/dashboard envs set first

#### Dashboard (Vercel recommended)

Recommended target: Vercel

- Root directory: `dashboard/`
- Framework: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Start command: Vercel-managed

Required dashboard env vars:

| Variable | Example | Why it matters |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://social-media-controller.onrender.com` | Browser and server API origin |
| `NEXT_PUBLIC_API_URL` | `https://social-media-controller.onrender.com` | Same origin, alternate key used in code |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://social-media-controller.vercel.app` | Public dashboard origin |
| `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI` | `https://social-media-controller.vercel.app/onboarding/callback` | OAuth return |
| `NEXT_PUBLIC_ENABLE_MOCK_BILLING` | `false` | Keep mock billing off in cloud |
| `RAZORPAY_KEY_ID` | `<rzp_test_... or live>` | Server-side order creation |
| `RAZORPAY_KEY_SECRET` | `<secret>` | Server-side order creation and verification |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `<rzp_test_... or live>` | Client checkout modal key |

If you choose Render for the dashboard instead of Vercel:

- Root directory: `dashboard/`
- Service type: Web Service
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Set the same `NEXT_PUBLIC_*` and Razorpay env vars there

#### Serverless-safe notes

- `dashboard/pages/api/verify-payment.ts` does not write to local disk.
- `dashboard/pages/api/analytics.ts` is a proxy to backend overview analytics.
- `dashboard/pages/api/analytics/funnel.ts` is a safe stub that returns empty stages.
- Local mock billing only activates outside production and uses explicit mock order/payment IDs.

#### Verifying production

1. Open your dashboard URL, for example `https://social-media-controller.vercel.app/`.
2. Sign in with an existing agency user. For staging or a disposable verification database, you can seed with:

   ```bash
   npm run prisma:seed
   ```

3. Visit:

   - `/dashboard`
   - `/analytics`
   - `/leads`
   - `/posts`
   - `/billing`

4. On analytics:

   - `Analytics` should load backend data from Render
   - `Dashboard Analytics` should show the safe funnel stub instead of erroring

5. On billing:

   - click `Upgrade with Razorpay`
   - complete the payment in Razorpay test mode using the test payment methods available in your Razorpay account
   - expected result: redirect to `/success?razorpay_payment_id=...`

6. Check backend health:

   ```bash
   curl https://social-media-controller.onrender.com/api/health
   ```

#### Common issues

- Mixed backend domains cause hard-to-debug auth and proxy problems. Use `https://social-media-controller.onrender.com` consistently.
- `CORS_ORIGIN` must be explicit in production. `*` will fail env validation.
- Cookie-based session restore depends on `AUTH_HTTPONLY_COOKIES=true`, `credentials: true`, and the dashboard origin being included in CORS.
- `dashboard/.env.local` is user-owned and gitignored. If local mock billing is not working, check `NEXT_PUBLIC_ENABLE_MOCK_BILLING=true` there.
- Local login will fail until you run both migrations and seed.
- The dashboard install is separate from the backend install: run `npm --prefix dashboard install`.
- `dashboard/utils/analytics.ts` still emits POST events to `/api/analytics`, while the current analytics route is GET-only. This is a known non-blocking limitation.

---

## Scaling Plan (Section 9.2)

### When to upgrade from Render free tier

| Signal | Action |
|--------|--------|
| API response p95 > 2s consistently | Upgrade to Render Starter ($7/mo) for dedicated CPU |
| Memory usage > 400MB (check `/api/metrics`) | Upgrade to Render Standard ($25/mo) |
| > 50 concurrent users | Upgrade to Render Standard + enable auto-scaling |
| > 500 WhatsApp messages/day | Move WhatsApp workers to separate Render worker dyno |
| Cold starts causing > 30s delays | Upgrade from free tier (free tier spins down after 15min) |

### When to upgrade Supabase plan

| Signal | Action |
|--------|--------|
| Database size > 500MB | Upgrade to Supabase Pro ($25/mo) |
| > 60 concurrent DB connections | Enable PgBouncer pooler (already configured in DATABASE_URL) |
| Backup retention needed > 7 days | Upgrade to Supabase Pro (7-day PITR included) |
| > 2GB bandwidth/month | Upgrade to Supabase Pro |

### First bottleneck under load

The **AI suggest-reply endpoint** (`POST /api/ai/suggest-reply`) will be the first to break under load because:
1. Each request makes a synchronous Anthropic API call (200–800ms latency)
2. Rate limited to 10 req/min per user — but concurrent users multiply this
3. No response caching (each message is unique)

**Mitigation when you hit this:**
- Add Redis caching for identical `lastMessage` + `businessType` combinations (TTL 5min)
- Move to async: queue the request, return a job ID, poll for result
- Consider Anthropic batch API for non-real-time use cases

### Recovery steps if database goes down

1. Check Supabase status: https://status.supabase.com
2. Verify `DATABASE_URL` pooler is reachable: `curl https://your-app.onrender.com/api/health?deps=1`
3. If pooler is down, switch `DATABASE_URL` to direct connection (port 5432) temporarily
4. To restore from backup: Supabase Dashboard → Project → Backups → select point-in-time → Restore
5. After restore, run `npx prisma migrate deploy` to ensure schema is current
6. Restart Render service to clear any stale Prisma connection pool

---

## How to rotate API keys

| Key | Steps |
|-----|-------|
| `JWT_SECRET` | Generate new: `openssl rand -hex 32`. Update in Render env vars. All existing sessions will be invalidated — users must log in again. |
| `JWT_REFRESH_SECRET` | Same as above. |
| `WA_ACCESS_TOKEN` | Meta Business Manager → System Users → Generate new token → update Render env var → redeploy. |
| `OPENAI_API_KEY` | OpenAI dashboard → API Keys → Create new → update Render → delete old key. |
| `ANTHROPIC_API_KEY` | Anthropic console → API Keys → Create new → update Render → delete old key. |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API Keys → Roll key → update Render. |
| `ENCRYPTION_KEY` | Run `npm run security:reencrypt:social-accounts` after updating to re-encrypt stored tokens. |

---

## Manual test checklist (pre-release)

Run this before every major release:

1. **Sign up**: create a new account at `/login` → click Sign Up → verify email received
2. **Log in**: log in with the new account → confirm redirect to `/dashboard`
3. **Log out**: click Logout → confirm redirect to `/login` → confirm token cleared
4. **WhatsApp config**: Settings → WhatsApp Configuration → enter `+91XXXXXXXXXX` → click Save → click Test Connection → confirm success toast
5. **Receive message**: send a WhatsApp message to your configured number → confirm it appears in `/conversations` within 30 seconds
6. **Suggest Reply**: open the conversation → click ✨ Suggest Reply → confirm 3 suggestions appear
7. **Send reply**: type a reply → confirm it sends (check WhatsApp on your phone)
8. **Auto-reply toggle**: DM Settings → toggle Auto-reply ON → send a test DM → confirm AI reply is sent within 60 seconds → toggle OFF
9. **Data export**: Settings → Export My Data → confirm JSON file downloads
10. **Health check**: `curl https://your-app.onrender.com/api/health?deps=1` → confirm all components `"ok"`
