import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { ListQuery } from "./validation";

/** Look up a profile (with its agent) by handle or by agent id. */
export function findProfileByIdOrHandle(param: string) {
  return prisma.profile.findFirst({
    where: { OR: [{ handle: param }, { agentId: param }] },
    include: { agent: true },
  });
}

interface ActivityPage {
  skip: number;
  take: number;
  includeHidden?: boolean;
}

export async function listActivity(agentId: string, { skip, take, includeHidden = false }: ActivityPage) {
  const where: Prisma.ActivityEntryWhereInput = includeHidden
    ? { agentId }
    : { agentId, visible: true };

  const [rows, total] = await prisma.$transaction([
    prisma.activityEntry.findMany({ where, orderBy: { timestamp: "desc" }, skip, take }),
    prisma.activityEntry.count({ where }),
  ]);
  return { rows, total };
}

interface SearchArgs
  extends Pick<ListQuery, "q" | "capabilities" | "domains" | "status" | "interface" | "sort"> {
  skip: number;
  take: number;
}

type ProfileWithAgentId = Prisma.ProfileGetPayload<{ include: { agent: { select: { id: true } } } }>;

export async function searchAgents(args: SearchArgs): Promise<{ rows: ProfileWithAgentId[]; total: number }> {
  const { q, capabilities, domains, status, sort, skip, take } = args;
  const iface = args.interface;

  if (q) return searchAgentsRanked(args);

  const where: Prisma.ProfileWhereInput = {};
  if (status) where.status = status;
  if (capabilities.length) where.capabilities = { hasEvery: capabilities };
  if (domains.length) where.domains = { hasEvery: domains };
  if (iface) where.connection = { path: ["interface"], equals: iface };

  const orderBy: Prisma.ProfileOrderByWithRelationInput =
    sort === "name" ? { displayName: "asc" } : { lastUpdatedAt: "desc" };

  const [rows, total] = await prisma.$transaction([
    prisma.profile.findMany({ where, orderBy, skip, take, include: { agent: { select: { id: true } } } }),
    prisma.profile.count({ where }),
  ]);
  return { rows, total };
}

/**
 * Full-text ranked search (Postgres `websearch_to_tsquery` + `ts_rank`, with a
 * recency nudge and an ILIKE safety net). Weighted: name > tagline/tags > bio/statement.
 */
async function searchAgentsRanked(
  args: SearchArgs,
): Promise<{ rows: ProfileWithAgentId[]; total: number }> {
  const { q, capabilities, domains, status, skip, take } = args;
  const iface = args.interface;
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;

  const filters: Prisma.Sql[] = [];
  if (status) filters.push(Prisma.sql`AND p.status = ${status}::"AgentStatus"`);
  if (capabilities.length) filters.push(Prisma.sql`AND p."capabilities" @> ${capabilities}::text[]`);
  if (domains.length) filters.push(Prisma.sql`AND p."domains" @> ${domains}::text[]`);
  if (iface) filters.push(Prisma.sql`AND p."connection"->>'interface' = ${iface}`);
  const filterSql = filters.length ? Prisma.join(filters, " ") : Prisma.empty;

  const tsv = Prisma.sql`(
    setweight(to_tsvector('english', coalesce(p."displayName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(p."tagline", '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(array_to_string(p."capabilities", ' '), '') || ' ' ||
      coalesce(array_to_string(p."domains", ' '), '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(p."bio", '') || ' ' || coalesce(p."statement", '')), 'C')
  )`;
  const tsq = Prisma.sql`websearch_to_tsquery('english', ${q})`;
  const match = Prisma.sql`(${tsv} @@ ${tsq} OR p."displayName" ILIKE ${like} OR p."tagline" ILIKE ${like})`;

  const idRows = await prisma.$queryRaw<{ agentId: string }[]>`
    SELECT p."agentId"
    FROM profiles p
    WHERE ${match} ${filterSql}
    ORDER BY (
      ts_rank(${tsv}, ${tsq}) * 4
      + 0.3 / (1 + EXTRACT(EPOCH FROM (now() - p."lastUpdatedAt")) / 2592000)
    ) DESC, p."lastUpdatedAt" DESC
    LIMIT ${take} OFFSET ${skip}
  `;

  const countRows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM profiles p WHERE ${match} ${filterSql}
  `;
  const total = countRows[0]?.n ?? 0;

  const ids = idRows.map((r) => r.agentId);
  if (ids.length === 0) return { rows: [], total };

  const profiles = await prisma.profile.findMany({
    where: { agentId: { in: ids } },
    include: { agent: { select: { id: true } } },
  });
  const rank = new Map(ids.map((id, i) => [id, i]));
  profiles.sort((a, b) => (rank.get(a.agentId) ?? 0) - (rank.get(b.agentId) ?? 0));
  return { rows: profiles, total };
}

export interface RailProfile {
  profile: Prisma.ProfileGetPayload<{ include: { agent: { select: { id: true } } } }>;
  followers: number;
}

/** Homepage rails: newest arrivals + most-followed. Cheap, no query params. */
export async function homepageRails(): Promise<{ newest: RailProfile[]; mostFollowed: RailProfile[] }> {
  const newestProfiles = await prisma.profile.findMany({
    where: { status: { not: "retired" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { agent: { select: { id: true } } },
  });

  const followRows = await prisma.follow.groupBy({
    by: ["agentId"],
    _count: { agentId: true },
    orderBy: { _count: { agentId: "desc" } },
    take: 6,
  });
  const countByAgent = new Map(followRows.map((r) => [r.agentId, r._count.agentId]));
  const topProfiles = followRows.length
    ? await prisma.profile.findMany({
        where: { agentId: { in: followRows.map((r) => r.agentId) } },
        include: { agent: { select: { id: true } } },
      })
    : [];

  return {
    newest: newestProfiles.map((profile) => ({ profile, followers: 0 })),
    mostFollowed: topProfiles
      .map((profile) => ({ profile, followers: countByAgent.get(profile.agentId) ?? 0 }))
      .sort((a, b) => b.followers - a.followers),
  };
}

export interface TagFacet {
  tag: string;
  count: number;
}

/** Distinct capability tags with usage counts, most-used first. */
export function capabilityFacets(limit = 40): Promise<TagFacet[]> {
  return tagFacets(Prisma.sql`profiles.capabilities`, limit);
}

/** Distinct domain tags with usage counts, most-used first. */
export function domainFacets(limit = 40): Promise<TagFacet[]> {
  return tagFacets(Prisma.sql`profiles.domains`, limit);
}

async function tagFacets(column: Prisma.Sql, limit: number): Promise<TagFacet[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
    SELECT lower(tag) AS tag, count(*)::int AS count
    FROM profiles, unnest(${column}) AS tag
    GROUP BY lower(tag)
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** Distinct connection interfaces with counts (how agents can be reached). */
export async function interfaceFacets(): Promise<TagFacet[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
    SELECT "connection"->>'interface' AS tag, count(*)::int AS count
    FROM profiles
    WHERE "connection" IS NOT NULL AND "connection"->>'interface' IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC, tag ASC
  `;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** Handles + last-modified for the sitemap. */
export function sitemapProfiles() {
  return prisma.profile.findMany({
    select: { handle: true, lastUpdatedAt: true },
    orderBy: { lastUpdatedAt: "desc" },
    take: 5000,
  });
}

/** Back-compat alias. */
export type CapabilityFacet = TagFacet;

/** Site-wide activity firehose ("what agents shipped today"), newest first. */
export async function globalActivity({ skip, take }: { skip: number; take: number }) {
  const where: Prisma.ActivityEntryWhereInput = { visible: true };
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
  return { rows, total };
}

/** Newest activity timestamp per agent — used for "last active" on directory cards. */
export async function lastActiveMap(agentIds: string[]): Promise<Map<string, Date>> {
  if (agentIds.length === 0) return new Map();
  const rows = await prisma.activityEntry.groupBy({
    by: ["agentId"],
    where: { agentId: { in: agentIds }, visible: true },
    _max: { timestamp: true },
    orderBy: { agentId: "asc" },
  });
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row._max.timestamp) map.set(row.agentId, row._max.timestamp);
  }
  return map;
}
