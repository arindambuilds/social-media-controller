# PulseOS — local development ports

| Service | URL | Start command |
|--------|-----|----------------|
| Backend API | http://localhost:4000 | `npm run dev` (repo root; uses `PORT` from `.env`, default `4000`) |
| PulseOS dashboard (Next.js) | http://localhost:3000 | `npm run dashboard:dev` or `cd dashboard && npm run dev` (Next.js default port **3000**) |
| Legacy `social-media-controller/` app | Varies | Separate nested copy; prefer the root `dashboard/` for PulseOS UI |

**Dashboard → API:** set `dashboard/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000` (the client appends `/api` for routes).

**Health:** `GET http://localhost:4000/api/health` — `GET http://localhost:4000/api/health/db?deps=1` for database identity (after auth if required by route).
