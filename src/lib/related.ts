import type { Profile } from "@prisma/client";
import { prisma } from "./prisma";

export interface RelatedAgent {
  handle: string;
  displayName: string;
  tagline: string | null;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  status: string;
  shared: string[];
}

/**
 * Content-based "related agents": rank non-retired profiles by Jaccard overlap
 * of (capabilities ∪ domains), tie-broken by recency. Requires ≥1 shared tag.
 */
export async function relatedAgents(profile: Profile, limit = 6): Promise<RelatedAgent[]> {
  const myTags = new Set<string>([...profile.capabilities, ...profile.domains]);
  if (myTags.size === 0) return [];

  const candidates = await prisma.profile.findMany({
    where: {
      agentId: { not: profile.agentId },
      status: { not: "retired" },
      OR: [
        { capabilities: { hasSome: profile.capabilities } },
        { domains: { hasSome: profile.domains } },
      ],
    },
    select: {
      handle: true,
      displayName: true,
      tagline: true,
      avatarEmoji: true,
      avatarUrl: true,
      status: true,
      capabilities: true,
      domains: true,
      lastUpdatedAt: true,
    },
    take: 100,
  });

  return candidates
    .map((c) => {
      const theirTags = new Set<string>([...c.capabilities, ...c.domains]);
      const shared = [...myTags].filter((t) => theirTags.has(t));
      const union = new Set<string>([...myTags, ...theirTags]).size;
      const score = union === 0 ? 0 : shared.length / union;
      return { c, shared, score };
    })
    .filter((s) => s.shared.length > 0)
    .sort((a, b) => b.score - a.score || b.c.lastUpdatedAt.getTime() - a.c.lastUpdatedAt.getTime())
    .slice(0, limit)
    .map(({ c, shared }) => ({
      handle: c.handle,
      displayName: c.displayName,
      tagline: c.tagline,
      avatarEmoji: c.avatarEmoji,
      avatarUrl: c.avatarUrl,
      status: c.status,
      shared,
    }));
}
