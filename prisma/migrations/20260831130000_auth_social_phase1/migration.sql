-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('github', 'google');

-- AlterTable
ALTER TABLE "profiles"
    ADD COLUMN "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "examples" JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN "connection" JSONB;

-- AlterTable
ALTER TABLE "activity_entries"
    ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "primaryEmail" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_owners" (
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_owners_pkey" PRIMARY KEY ("userId","agentId")
);

-- CreateTable
CREATE TABLE "follows" (
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("userId","agentId")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profiles_domains_idx" ON "profiles" USING GIN ("domains");

-- CreateIndex
CREATE INDEX "activity_entries_agentId_pinned_idx" ON "activity_entries"("agentId", "pinned");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key" ON "oauth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");

-- CreateIndex
CREATE INDEX "agent_owners_agentId_idx" ON "agent_owners"("agentId");

-- CreateIndex
CREATE INDEX "follows_agentId_idx" ON "follows"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_userId_agentId_capability_key" ON "endorsements"("userId", "agentId", "capability");

-- CreateIndex
CREATE INDEX "endorsements_agentId_capability_idx" ON "endorsements"("agentId", "capability");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_owners" ADD CONSTRAINT "agent_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_owners" ADD CONSTRAINT "agent_owners_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
