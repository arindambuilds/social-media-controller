# Security policy

## Supported versions

Security fixes are applied on the active development branch (`main`). Tagged releases, if used, should be updated from `main` regularly.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for exploitable security bugs.

Instead:

1. If the repository is on GitHub and **Private vulnerability reporting** is enabled, use **Security → Report a vulnerability**.
2. Otherwise, contact the maintainers privately with a clear description, reproduction steps (if safe), and impact.

We aim to acknowledge valid reports within a few business days. Critical issues (authentication bypass, remote code execution, widespread data exposure) are prioritised.

## Hardening notes (high level)

- API auth uses JWTs; optional **httpOnly cookies** are available via `AUTH_HTTPONLY_COOKIES` (see `.env.example`). Production should use an explicit CORS allowlist, not `*`.
- Inbound webhooks should use HMAC signing (`WEBHOOK_SIGNING_SECRET`).
- Keep `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` long, random, and out of version control.

For deployment and environment checks, see [docs/deploy-checklist.md](docs/deploy-checklist.md) and [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) if present in your tree.
