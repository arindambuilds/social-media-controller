# GitHub setup

## Create the remote and push

1. On GitHub, create a new repository (empty, or without a conflicting README if you already have one locally).
2. From this project root:

   ```bash
   git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

Use SSH remotes if you prefer (`git@github.com:YOUR_ORG/YOUR_REPO.git`).

## Continuous integration

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

**Triggers:** push and pull request to `main` or `master`.

**Job `verify`:** installs API and dashboard dependencies, runs `prisma migrate deploy` and `prisma:seed` against a Postgres 16 service container, then:

- `npm run lint` — API TypeScript check  
- `npm test` — Vitest API smoke tests  
- `npm run dashboard:build` — Next.js production build  

No GitHub **secrets** are required for this default pipeline. Optional later additions (e.g. deploy keys, `SENTRY_AUTH_TOKEN`) can be added under **Settings → Secrets and variables → Actions**.

### Optional status badge

After the first successful run, you can add a badge to your README (replace `YOUR_ORG` and `YOUR_REPO`):

```markdown
[![CI](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/ci.yml)
```

## Branch protection (recommended for collaborators)

**Settings → Branches → Add branch protection rule** for `main`:

- Require a pull request before merging (optional but typical).
- Require status checks to pass — enable the **verify** check from CI.

## Security reporting

See [SECURITY.md](SECURITY.md).
