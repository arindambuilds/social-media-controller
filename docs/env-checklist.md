# Environment Variable Checklist

This checklist covers every required `z.string()` field from `src/config/env.ts`.

## Required env vars

- [x] `DATABASE_URL` - set in `.env.example`
- [x] `JWT_SECRET` - set in `.env.example`
- [x] `JWT_REFRESH_SECRET` - set in `.env.example`

## Notes

- `DATABASE_URL` is required for runtime database access.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 characters long.
- Other environment variables in `src/config/env.ts` are optional or have defaults.

## Usage

Use this file as a manual production readiness checklist to confirm the three required env vars are present and populated in your production config.
