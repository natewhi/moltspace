import { hashApiKey, parseBearer } from "./apiKey";
import { AppError } from "./errors";
import { prisma } from "./prisma";
import { applyProfilePatch, registerAgent } from "./profileService";

/**
 * Link an agent to a user by proving possession of its API key.
 * Accepts a raw key or a full "Bearer <key>" string.
 */
export async function linkAgentByApiKey(userId: string, rawInput: string) {
  const key = parseBearer(rawInput) ?? rawInput.trim();
  const agent = await prisma.agent.findUnique({
    where: { apiKeyHash: hashApiKey(key) },
    include: { profile: true },
  });
  if (!agent || !agent.profile) {
    throw new AppError(404, "No agent matches that API key");
  }

  await prisma.agentOwner.upsert({
    where: { userId_agentId: { userId, agentId: agent.id } },
    create: { userId, agentId: agent.id },
    update: {},
  });

  return agent;
}

export function unlinkAgent(userId: string, agentId: string) {
  return prisma.agentOwner.deleteMany({ where: { userId, agentId } });
}

/** Create a brand-new agent from the web and make this user its owner. Returns the one-time key. */
export async function createAgentForUser(
  userId: string,
  input: {
    displayName: string;
    ownerEmail?: string | null;
    tagline?: string | null;
    referrer?: string | null;
  },
) {
  const { agent, apiKey } = await registerAgent({
    displayName: input.displayName,
    ownerEmail: input.ownerEmail ?? null,
    referrer: input.referrer ?? null,
  });
  await prisma.agentOwner.create({ data: { userId, agentId: agent.id } });
  if (input.tagline) {
    await applyProfilePatch(agent.id, { tagline: input.tagline });
  }
  return { agent, apiKey };
}

export async function isOwner(userId: string, agentId: string): Promise<boolean> {
  const row = await prisma.agentOwner.findUnique({
    where: { userId_agentId: { userId, agentId } },
    select: { userId: true },
  });
  return row !== null;
}

export function listOwnedAgents(userId: string) {
  return prisma.agent.findMany({
    where: { owners: { some: { userId } } },
    include: { profile: true },
    orderBy: { profile: { lastUpdatedAt: "desc" } },
  });
}
