-- Allow platform-level audit events (e.g. signup) before a Client row exists.
ALTER TABLE "AuditLog" ALTER COLUMN "clientId" DROP NOT NULL;
