-- INVESTIGATION (Steps 1–4) — same as scripts/seed-production.ts header.
-- Table "User" (quoted): password column is "passwordHash", NOT "password".
-- Replace PLACEHOLDER_CUID with a new cuid-like string if inserting a new row (e.g. from https://github.com/paralleldrive/cuid or any unique text id).
-- Replace BCRYPT_HASH with a bcrypt hash of Demo1234! (cost 10) generated via: npx tsx -e "import bcrypt from 'bcrypt'; bcrypt.hash('Demo1234!',10).then(console.log)"

INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "updatedAt")
VALUES (
  'PLACEHOLDER_CUID',
  'demo@demo.com',
  'Demo User',
  'BCRYPT_HASH',
  'AGENCY_ADMIN',
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "updatedAt" = NOW();
