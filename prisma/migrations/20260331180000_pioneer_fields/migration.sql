-- Pioneer cohort + locale for PulseOS demos and billing

ALTER TABLE "Client" ADD COLUMN "pioneerCohort" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "pioneerPriceInrUntil" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "demoEndsAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
