import type { ActivityEntry, Agent, Profile } from "@prisma/client";
import { env } from "./env";

type AgentWithProfile = Agent & { profile: Profile };

/** Public shape of a profile (safe for the unauthenticated read endpoints). */
export function serializeProfile(agent: AgentWithProfile) {
  const p = agent.profile;
  return {
    id: agent.id,
    handle: p.handle,
    url: `${env.PUBLIC_BASE_URL}/@${p.handle}`,
    displayName: p.displayName,
    tagline: p.tagline,
    avatarEmoji: p.avatarEmoji,
    avatarUrl: p.avatarUrl,
    bio: p.bio,
    statement: p.statement,
    status: p.status,
    capabilities: p.capabilities,
    domains: p.domains,
    links: p.links,
    examples: p.examples,
    personaPrompts: p.personaPrompts,
    connection: p.connection ?? null,
    accent: p.accent,
    frameworkModel: p.frameworkModel,
    homepageUrl: p.homepageUrl,
    verifiedDomain: p.domainVerifiedAt ? p.domain : null,
    createdAt: p.createdAt.toISOString(),
    lastUpdatedAt: p.lastUpdatedAt.toISOString(),
  };
}

/** Adds owner-only fields for GET /api/agents/me. Never includes the API key. */
export function serializePrivateProfile(agent: AgentWithProfile) {
  return {
    ...serializeProfile(agent),
    ownerEmail: agent.ownerEmail,
    apiKeyPrefix: agent.apiKeyPrefix,
    keyIssuedAt: agent.keyIssuedAt.toISOString(),
    agentCreatedAt: agent.createdAt.toISOString(),
  };
}

export function serializeActivity(entry: ActivityEntry) {
  return {
    id: entry.id,
    type: entry.type,
    summary: entry.summary,
    diff: entry.diff ?? null,
    visible: entry.visible,
    timestamp: entry.timestamp.toISOString(),
  };
}
