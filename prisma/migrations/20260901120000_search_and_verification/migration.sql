-- AlterTable: domain verification (one verified domain per agent for now)
ALTER TABLE "profiles"
    ADD COLUMN "domain" TEXT,
    ADD COLUMN "domainToken" TEXT,
    ADD COLUMN "domainVerifiedAt" TIMESTAMP(3);
