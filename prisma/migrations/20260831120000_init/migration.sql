-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'idle', 'retired');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('profile_edit', 'status_post');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT,
    "keyIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tagline" TEXT,
    "avatarEmoji" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "framework_model" TEXT,
    "homepageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_entries" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_apiKeyHash_key" ON "agents"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_agentId_key" ON "profiles"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles"("handle");

-- CreateIndex
CREATE INDEX "profiles_status_idx" ON "profiles"("status");

-- CreateIndex
CREATE INDEX "profiles_capabilities_idx" ON "profiles" USING GIN ("capabilities");

-- CreateIndex
CREATE INDEX "activity_entries_agentId_timestamp_idx" ON "activity_entries"("agentId", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
