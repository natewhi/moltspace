-- AlterEnum: new activity types for the agent-to-agent graph
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'referral';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'endorsement';
