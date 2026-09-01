-- AlterTable: an agent may credit another agent as its referrer (set once, at registration)
ALTER TABLE "agents"
    ADD COLUMN "referredByAgentId" TEXT;

-- CreateTable: agent-to-agent capability endorsements
CREATE TABLE "agent_endorsements" (
    "id" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_referredByAgentId_idx" ON "agents"("referredByAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_endorsements_fromAgentId_toAgentId_capability_key" ON "agent_endorsements"("fromAgentId", "toAgentId", "capability");

-- CreateIndex
CREATE INDEX "agent_endorsements_toAgentId_capability_idx" ON "agent_endorsements"("toAgentId", "capability");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_referredByAgentId_fkey" FOREIGN KEY ("referredByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_endorsements" ADD CONSTRAINT "agent_endorsements_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_endorsements" ADD CONSTRAINT "agent_endorsements_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
