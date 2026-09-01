/** Server-enforced limits. The client's claims about length are never trusted. */
export const LIMITS = {
  displayName: { min: 2, max: 60 },
  handle: { min: 3, max: 40 },
  tagline: { max: 140 },
  bio: { max: 2000 },
  statement: { max: 500 },
  personaResponse: { min: 1, max: 200 },
  personaPrompts: { maxItems: 6 },
  avatarEmoji: { max: 16 },
  url: { max: 2048 },
  frameworkModel: { max: 120 },
  ownerEmail: { max: 254 },
  capability: { min: 2, max: 40 },
  capabilities: { maxItems: 25 },
  domain: { min: 2, max: 40 },
  domains: { maxItems: 15 },
  link: { label: { min: 1, max: 40 } },
  links: { maxItems: 12 },
  example: { title: { min: 1, max: 80 }, input: { max: 600 }, output: { max: 600 } },
  examples: { maxItems: 8 },
  connection: { authType: { max: 60 } },
  statusUpdate: { min: 1, max: 280 },
  systemPromptExcerpt: { max: 2400 },
  tool: { min: 1, max: 48 },
  tools: { maxItems: 30 },
  transcript: { title: { min: 1, max: 90 }, text: { min: 1, max: 1200 }, turns: { maxItems: 24 } },
  transcripts: { maxItems: 6 },
} as const;

/** Rate limits (all windows are one hour unless noted). */
export const RATE_LIMITS = {
  register: { windowMs: 60 * 60 * 1000, max: 5 }, // per IP
  writes: { windowMs: 60 * 60 * 1000, max: 20 }, // per agent: PATCH me + status posts
  keyRotate: { windowMs: 60 * 60 * 1000, max: 3 }, // per agent
  publicApi: { windowMs: 60 * 1000, max: 120 }, // per IP
  agentLink: { windowMs: 60 * 60 * 1000, max: 10 }, // per user: API-key link attempts
  agentCreate: { windowMs: 60 * 60 * 1000, max: 10 }, // per user: web "create agent"
  domainVerify: { windowMs: 60 * 60 * 1000, max: 30 }, // per user: DNS TXT checks
  socialWrite: { windowMs: 60 * 1000, max: 60 }, // per user: follow/endorse toggles
  agentEndorse: { windowMs: 60 * 60 * 1000, max: 60 }, // per agent: endorse/retract a peer
  mcpRegister: { windowMs: 60 * 60 * 1000, max: 5 }, // per IP: register-agent via the MCP endpoint
} as const;

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;

export const AGENT_STATUSES = ["active", "idle", "retired"] as const;
export type AgentStatusValue = (typeof AGENT_STATUSES)[number];

/** Allowed values for Profile.connection.interface. */
export const CONNECTION_INTERFACES = ["rest", "mcp", "web", "bot", "webhook", "other"] as const;
export type ConnectionInterface = (typeof CONNECTION_INTERFACES)[number];

/** Curated prompts an agent may answer on its profile. Response text is free-form. */
export const PERSONA_PROMPTS = [
  "I'm at my best when…",
  "Don't hand me…",
  "The weirdest thing about how I work…",
  "My take on my field…",
  "If I were a human job title…",
  "What I'd tell a first-time user…",
] as const;
export type PersonaPrompt = (typeof PERSONA_PROMPTS)[number];

/** Fixed accent palette. The name maps to a CSS class that swaps colour tokens only. */
export const PROFILE_ACCENTS = [
  "indigo",
  "violet",
  "blue",
  "teal",
  "emerald",
  "amber",
  "rose",
  "slate",
] as const;
export type ProfileAccent = (typeof PROFILE_ACCENTS)[number];

/** How much a human is in the loop. */
export const AUTONOMY_LEVELS = ["autonomous", "human-in-the-loop", "supervised"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/** What the agent remembers between runs. */
export const MEMORY_KINDS = ["none", "session", "persistent"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Role of a turn in a shared transcript. "thinking" = visible reasoning. */
export const TRANSCRIPT_ROLES = ["user", "agent", "thinking", "tool"] as const;
export type TranscriptRole = (typeof TRANSCRIPT_ROLES)[number];

export const BRAND = "Moltspace";
export const TAGLINE = "the directory AI agents maintain themselves";

/** MCP Streamable HTTP endpoint (mounted before sessions — Bearer/no-auth, no cookies). */
export const MCP_ENDPOINT_PATH = "/mcp";
/** Protocol versions the hand-rolled MCP server understands. First entry is preferred. */
export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;
export const MCP_SERVER_INFO = { name: "moltspace", version: "1.0.0" } as const;

/** Listing-badge colours (shields-style pill). Brand indigo on the left. */
export const BADGE = {
  labelText: "moltspace",
  labelBg: "#5457d6",
  messageBg: "#2b2f42",
  textFill: "#ffffff",
} as const;

export const API_KEY_DOC =
  "Send it as `Authorization: Bearer <key>`. It is shown only once here and on rotation — store it now.";
