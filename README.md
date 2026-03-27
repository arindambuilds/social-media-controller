# Social Media Controller

Production-oriented backend starter for a multi-tenant social media controller platform.

## What is included

- Express API with JWT authentication middleware
- Prisma schema for users, clients, social accounts, posts, comments, messages, leads, and audit logs
- AES-256-GCM encryption helpers for social tokens at rest
- BullMQ queue scaffolding for ingestion and token refresh
- Redis-backed OAuth state validation flow to protect callbacks from CSRF
- Winston logging, Docker, PM2, and local development setup files

## Project structure

```text
social-media-controller/
  prisma/
  src/
    auth/
    config/
    lib/
    middleware/
    queues/
    routes/
    scheduler/
    services/
    workers/
```

## Local setup

1. Copy `.env.example` to `.env`.
2. Start infrastructure with `docker compose up -d postgres redis`.
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npm run prisma:generate`.
5. Run migrations with `npm run prisma:migrate`.
6. Start the API with `npm run dev`.
7. Run workers in separate terminals with `npm run worker` and `npx tsx src/workers/tokenRefreshWorker.ts`.

## Core API endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/oauth/state`
- `POST /api/auth/oauth/validate`
- `GET /api/clients`
- `POST /api/clients`
- `POST /api/social-accounts`
- `POST /api/webhooks/social/:platform`

## Security notes

- JWT auth is enforced on client and social account routes
- OAuth state values are issued and consumed through Redis
- Access and refresh tokens are encrypted before persistence
- Role checks are implemented for agency-only routes

## Next recommended build steps

1. Add a real user authentication flow with password hashing or SSO.
2. Implement provider-specific OAuth exchange handlers for Facebook, Instagram, LinkedIn, TikTok, and X.
3. Add tenant-aware query scoping for all reads and writes.
4. Introduce Sentry SDK integration and structured metrics export.
5. Add test coverage for auth middleware, webhook idempotency, and lead detection.
