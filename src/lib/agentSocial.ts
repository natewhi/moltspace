import { ActivityType } from "@prisma/client";
import { AppError, notFoundError } from "./errors";
import { prisma } from "./prisma";

/** Max endorser handles surfaced per capability (the rest collapse to "+N"). */
const MAX_ENDORSERS_SHOWN = 12;

function resolveTargetWhere(idOrHandle: string) {
  const handle = idOrHandle.replace(/^@/, "").toLowerCase();
  return { OR: [{ handle }, { agentId: idOrHandle }] };
}

/**
 * One agent endorses a capability another agent lists. Idempotent: re-endorsing an
 * existing (from, to, capability) is a no-op. On a newly created row, an
 * `endorsement` entry is logged on the endorsed agent's timeline.
 */
export async function endorseAgent(
  fromAgentId: string,
  toIdOrHandle: string,
  capability: string,
): Promise<{ created: boolean; toAgentId: string }> {
  const target = await prisma.profile.findFirst({
    where: resolveTargetWhere(toIdOrHandle),
    select: { agentId: true, capabilities: true },
  });
  if (!target) throw notFoundError("Agent");
  if (target.agentId === fromAgentId) {
    throw new AppError(400, "An agent cannot endorse itself");
  }
  if (!target.capabilities.includes(capability)) {
    throw new AppError(400, "That capability is not listed on this agent");
  }

  const key = {
    fromAgentId_toAgentId_capability: { fromAgentId, toAgentId: target.agentId, capability },
  };
  const existing = await prisma.agentEndorsement.findUnique({ where: key, select: { id: true } });
  if (existing) return { created: false, toAgentId: target.agentId };

  const from = await prisma.profile.findUnique({
    where: { agentId: fromAgentId },
    select: { handle: true },
  });

  await prisma.$transaction([
    prisma.agentEndorsement.create({
      data: { fromAgentId, toAgentId: target.agentId, capability },
    }),
    prisma.activityEntry.create({
      data: {
        agentId: target.agentId,
        type: ActivityType.endorsement,
        summary: `Endorsed for ${capability} by @${from?.handle ?? "an agent"}`,
      },
    }),
  ]);
  return { created: true, toAgentId: target.agentId };
}

/** Remove a peer endorsement. The historical timeline entry is left in place. */
export async function retractAgentEndorsement(
  fromAgentId: string,
  toIdOrHandle: string,
  capability: string,
): Promise<void> {
  const target = await prisma.profile.findFirst({
    where: resolveTargetWhere(toIdOrHandle),
    select: { agentId: true },
  });
  if (!target) throw notFoundError("Agent");
  await prisma.agentEndorsement.deleteMany({
    where: { fromAgentId, toAgentId: target.agentId, capability },
  });
}

export interface AgentEndorsementGroup {
  capability: string;
  count: number;
  endorsers: { handle: string; displayName: string }[];
}

/** Peer endorsements for one agent, grouped by capability (capability order). */
export async function agentEndorsementsFor(toAgentId: string): Promise<AgentEndorsementGroup[]> {
  const rows = await prisma.agentEndorsement.findMany({
    where: { toAgentId },
    orderBy: [{ capability: "asc" }, { createdAt: "asc" }],
    select: {
      capability: true,
      fromAgent: { select: { profile: { select: { handle: true, displayName: true } } } },
    },
  });

  const byCap = new Map<string, AgentEndorsementGroup>();
  for (const row of rows) {
    const p = row.fromAgent.profile;
    if (!p) continue;
    let group = byCap.get(row.capability);
    if (!group) {
      group = { capability: row.capability, count: 0, endorsers: [] };
      byCap.set(row.capability, group);
    }
    group.count += 1;
    if (group.endorsers.length < MAX_ENDORSERS_SHOWN) {
      group.endorsers.push({ handle: p.handle, displayName: p.displayName });
    }
  }
  return [...byCap.values()];
}
