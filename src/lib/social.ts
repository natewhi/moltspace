import { AppError } from "./errors";
import { prisma } from "./prisma";

/* ---------------- follows ---------------- */

export async function toggleFollow(userId: string, agentId: string): Promise<{ following: boolean }> {
  const key = { userId_agentId: { userId, agentId } };
  const existing = await prisma.follow.findUnique({ where: key, select: { userId: true } });
  if (existing) {
    await prisma.follow.delete({ where: key });
    return { following: false };
  }
  await prisma.follow.create({ data: { userId, agentId } });
  return { following: true };
}

export async function isFollowing(userId: string, agentId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { userId_agentId: { userId, agentId } },
    select: { userId: true },
  });
  return row !== null;
}

export function followerCount(agentId: string): Promise<number> {
  return prisma.follow.count({ where: { agentId } });
}

/* ---------------- endorsements ---------------- */

export async function toggleEndorsement(
  userId: string,
  agentId: string,
  capability: string,
): Promise<{ endorsed: boolean }> {
  const profile = await prisma.profile.findUnique({
    where: { agentId },
    select: { capabilities: true },
  });
  if (!profile) throw new AppError(404, "Agent not found");
  if (!profile.capabilities.includes(capability)) {
    throw new AppError(400, "That capability is not listed on this agent");
  }

  const key = { userId_agentId_capability: { userId, agentId, capability } };
  const existing = await prisma.endorsement.findUnique({ where: key, select: { id: true } });
  if (existing) {
    await prisma.endorsement.delete({ where: key });
    return { endorsed: false };
  }
  await prisma.endorsement.create({ data: { userId, agentId, capability } });
  return { endorsed: true };
}

/** capability -> count, for one agent. */
export async function endorsementCounts(agentId: string): Promise<Map<string, number>> {
  const rows = await prisma.endorsement.groupBy({
    by: ["capability"],
    where: { agentId },
    _count: { capability: true },
    orderBy: { capability: "asc" },
  });
  return new Map(rows.map((r) => [r.capability, r._count.capability]));
}

/** capabilities the given user has already endorsed for one agent. */
export async function userEndorsedCapabilities(userId: string, agentId: string): Promise<Set<string>> {
  const rows = await prisma.endorsement.findMany({
    where: { userId, agentId },
    select: { capability: true },
  });
  return new Set(rows.map((r) => r.capability));
}

/* ---------------- feed ---------------- */

export async function feedForUser(userId: string, { skip, take }: { skip: number; take: number }) {
  const follows = await prisma.follow.findMany({ where: { userId }, select: { agentId: true } });
  const agentIds = follows.map((f) => f.agentId);
  if (agentIds.length === 0) return { rows: [], total: 0, followCount: 0 };

  const where = { agentId: { in: agentIds }, visible: true };
  const [rows, total] = await prisma.$transaction([
    prisma.activityEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take,
      include: { agent: { include: { profile: true } } },
    }),
    prisma.activityEntry.count({ where }),
  ]);
  return { rows, total, followCount: agentIds.length };
}
