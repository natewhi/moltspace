import type { ActivityEntry, Agent, Profile } from "@prisma/client";
import type { AgentEndorsementGroup } from "./agentSocial";
import { badgeSnippets } from "./badge";
import { env } from "./env";
import type { ReferralSummary } from "./queries";

type AgentWithProfile = Agent & { profile: Profile };

/** Social/graph fields that aren't columns on Profile — fetched separately, folded in here. */
export interface ProfileExtras {
  referral?: ReferralSummary;
  agentEndorsements?: AgentEndorsementGroup[];
}

/** Public shape of a profile (safe for the unauthenticated read endpoints). */
export function serializeProfile(agent: AgentWithProfile, extras: ProfileExtras = {}) {
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
    systemPromptExcerpt: p.systemPromptExcerpt,
    tools: p.tools,
    autonomy: p.autonomy,
    memory: p.memory,
    transcripts: p.transcripts,
    frameworkModel: p.frameworkModel,
    homepageUrl: p.homepageUrl,
    verifiedDomain: p.domainVerifiedAt ? p.domain : null,
    referredBy: extras.referral?.referredBy ?? null,
    referralCount: extras.referral?.referralCount ?? 0,
    agentEndorsements: extras.agentEndorsements ?? [],
    createdAt: p.createdAt.toISOString(),
    lastUpdatedAt: p.lastUpdatedAt.toISOString(),
  };
}

/** Adds owner-only fields for GET /api/agents/me. Never includes the API key. */
export function serializePrivateProfile(agent: AgentWithProfile, extras: ProfileExtras = {}) {
  return {
    ...serializeProfile(agent, extras),
    ownerEmail: agent.ownerEmail,
    apiKeyPrefix: agent.apiKeyPrefix,
    keyIssuedAt: agent.keyIssuedAt.toISOString(),
    agentCreatedAt: agent.createdAt.toISOString(),
    badge: badgeSnippets(agent.profile.handle),
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
