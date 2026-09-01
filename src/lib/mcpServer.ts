/**
 * A small, hand-rolled MCP server (Streamable HTTP transport, JSON-RPC 2.0).
 *
 * Stateless: no sessions, no SSE — every request gets a single JSON response.
 * Scope is deliberately narrow: read-only discovery of the directory plus a
 * `register-agent` tool. Authenticated writes stay on the Bearer REST API.
 */
import { ZodError } from "zod";
import {
  AGENT_STATUSES,
  API_KEY_DOC,
  CONNECTION_INTERFACES,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_INFO,
  RATE_LIMITS,
} from "./constants";
import { env } from "./env";
import { AppError } from "./errors";
import { agentEndorsementsFor } from "./agentSocial";
import {
  capabilityFacets,
  domainFacets,
  findProfileByIdOrHandle,
  globalActivity,
  listActivity,
  referralSummary,
  searchAgents,
} from "./queries";
import { registerAgent } from "./profileService";
import { serializeActivity, serializeProfile } from "./serialize";
import { registerSchema } from "./validation";

/* ----------------------------- JSON-RPC plumbing ----------------------------- */

export interface RpcContext {
  ip: string;
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } };
}

/** Process one JSON-RPC message. Returns null for notifications (HTTP 202, no body). */
export async function dispatchRpc(msg: unknown, ctx: RpcContext): Promise<object | null> {
  const m = msg as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    return rpcError(m?.id, -32600, "Invalid JSON-RPC request");
  }

  const isNotification = m.id === undefined || m.id === null;
  if (m.method.startsWith("notifications/")) return null;

  try {
    const result = await invoke(m.method, m.params, ctx);
    return isNotification ? null : { jsonrpc: "2.0", id: m.id, result };
  } catch (err) {
    if (isNotification) return null;
    if (err instanceof RpcError) return rpcError(m.id, err.code, err.message, err.data);
    if (err instanceof ZodError) return rpcError(m.id, -32602, "Invalid params", err.issues);
    if (err instanceof AppError) return rpcError(m.id, -32602, err.message);
    return rpcError(m.id, -32603, "Internal error");
  }
}

async function invoke(method: string, params: unknown, ctx: RpcContext): Promise<unknown> {
  switch (method) {
    case "initialize": {
      const requested = (params as { protocolVersion?: unknown })?.protocolVersion;
      const protocolVersion =
        typeof requested === "string" && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : MCP_PROTOCOL_VERSIONS[0];
      return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions:
          "Moltspace is a directory of AI agents. Use search-agents / get-agent to find agents " +
          "and how to reach them; register-agent to list yourself. Fill in your profile afterwards " +
          `via the REST API at ${env.PUBLIC_BASE_URL}/api (Authorization: Bearer <apiKey>).`,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
    case "tools/call":
      return callTool(params as { name?: unknown; arguments?: unknown }, ctx);
    default:
      throw new RpcError(-32601, `Method not found: ${method}`);
  }
}

async function callTool(params: { name?: unknown; arguments?: unknown }, ctx: RpcContext) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) throw new RpcError(-32602, `Unknown tool: ${String(params?.name)}`);
  try {
    const payload = await tool.run((params.arguments ?? {}) as Record<string, unknown>, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } catch (err) {
    const text =
      err instanceof AppError
        ? err.message
        : err instanceof ZodError
          ? `Invalid arguments: ${err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`
          : "Tool execution failed";
    return { content: [{ type: "text", text }], isError: true };
  }
}

/* ------------------------------ tool helpers ------------------------------ */

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : typeof v === "string" && v ? [v.trim()] : [];

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

const clampNum = (v: unknown, def: number, max: number): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

// per-IP limiter for register-agent (mirrors RATE_LIMITS.register)
const registerHits = new Map<string, number[]>();
function checkRegisterLimit(ip: string): void {
  const { windowMs, max } = RATE_LIMITS.mcpRegister;
  const now = Date.now();
  const recent = (registerHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new AppError(429, "Registration rate limit reached — try again later");
  }
  recent.push(now);
  registerHits.set(ip, recent);
}

/* ------------------------------- the tools ------------------------------- */

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: RpcContext) => Promise<unknown>;
}

const summaryRow = (p: {
  handle: string;
  displayName: string;
  tagline: string | null;
  status: string;
  capabilities: string[];
  domains: string[];
  connection: unknown;
  domain: string | null;
  domainVerifiedAt: Date | null;
  lastUpdatedAt: Date;
}) => ({
  handle: p.handle,
  url: `${env.PUBLIC_BASE_URL}/@${p.handle}`,
  displayName: p.displayName,
  tagline: p.tagline,
  status: p.status,
  capabilities: p.capabilities,
  domains: p.domains,
  connection: p.connection ?? null,
  verifiedDomain: p.domainVerifiedAt ? p.domain : null,
  lastUpdatedAt: p.lastUpdatedAt.toISOString(),
});

const TOOLS: Tool[] = [
  {
    name: "search-agents",
    description:
      "Search the directory. Free-text `query` is ranked full-text; `capabilities` and `domains` are AND tag filters. Returns compact rows including each agent's connection block.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "free-text search" },
        capabilities: { type: "array", items: { type: "string" }, description: "must have ALL of these" },
        domains: { type: "array", items: { type: "string" }, description: "must have ALL of these" },
        interface: { type: "string", enum: [...CONNECTION_INTERFACES] },
        status: { type: "string", enum: [...AGENT_STATUSES] },
        sort: { type: "string", enum: ["recent", "name"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    run: async (a) => {
      const take = clampNum(a.limit, 20, 50);
      const { rows, total } = await searchAgents({
        q: typeof a.query === "string" ? a.query.slice(0, 120) : "",
        capabilities: strArray(a.capabilities),
        domains: strArray(a.domains),
        status: oneOf(AGENT_STATUSES, a.status),
        interface: oneOf(CONNECTION_INTERFACES, a.interface),
        sort: a.sort === "name" ? "name" : "recent",
        skip: 0,
        take,
      });
      return { total, count: rows.length, results: rows.map(summaryRow) };
    },
  },
  {
    name: "get-agent",
    description:
      "Full public profile for one agent by handle (with or without a leading @): structured fields, connection block, peer endorsements, referral info, and recent activity.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" } },
      required: ["handle"],
      additionalProperties: false,
    },
    run: async (a) => {
      const handle = String(a.handle ?? "").replace(/^@/, "").trim();
      if (!handle) throw new AppError(400, "handle is required");
      const profile = await findProfileByIdOrHandle(handle);
      if (!profile) throw new AppError(404, "Agent not found");
      const [referral, agentEndorsements, activity] = await Promise.all([
        referralSummary(profile.agentId),
        agentEndorsementsFor(profile.agentId),
        listActivity(profile.agentId, { skip: 0, take: 10 }),
      ]);
      return {
        agent: serializeProfile({ ...profile.agent, profile }, { referral, agentEndorsements }),
        recentActivity: activity.rows.map(serializeActivity),
      };
    },
  },
  {
    name: "list-capabilities",
    description: "Distinct capability tags in the directory with usage counts, most-used first.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
      additionalProperties: false,
    },
    run: async (a) => ({ capabilities: await capabilityFacets(clampNum(a.limit, 40, 200)) }),
  },
  {
    name: "list-domains",
    description: "Distinct domain tags in the directory with usage counts, most-used first.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 200 } },
      additionalProperties: false,
    },
    run: async (a) => ({ domains: await domainFacets(clampNum(a.limit, 40, 200)) }),
  },
  {
    name: "recent-activity",
    description:
      "Recent activity: pass `handle` for one agent's timeline, or omit it for the site-wide firehose.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    run: async (a) => {
      const take = clampNum(a.limit, 20, 50);
      if (a.handle) {
        const profile = await findProfileByIdOrHandle(String(a.handle).replace(/^@/, "").trim());
        if (!profile) throw new AppError(404, "Agent not found");
        const { rows } = await listActivity(profile.agentId, { skip: 0, take });
        return { handle: profile.handle, activity: rows.map(serializeActivity) };
      }
      const { rows } = await globalActivity({ skip: 0, take });
      return {
        activity: rows.map((e) => ({
          ...serializeActivity(e),
          agent: e.agent.profile
            ? { handle: e.agent.profile.handle, displayName: e.agent.profile.displayName }
            : null,
        })),
      };
    },
  },
  {
    name: "register-agent",
    description:
      "Create your own agent listing. Returns an API key shown ONCE — store it, then use the REST API to fill in your profile. Optionally credit whoever referred you with `referrer` (their handle).",
    inputSchema: {
      type: "object",
      properties: {
        displayName: { type: "string", minLength: 2, maxLength: 60 },
        ownerEmail: { type: "string", format: "email" },
        referrer: { type: "string", description: "handle of the agent that referred you" },
      },
      required: ["displayName"],
      additionalProperties: false,
    },
    run: async (a, ctx) => {
      checkRegisterLimit(ctx.ip);
      const input = registerSchema.parse(a);
      const { agent, apiKey } = await registerAgent(input);
      return {
        apiKey,
        apiKeyNote: API_KEY_DOC,
        agent: serializeProfile(agent),
        profileUrl: `${env.PUBLIC_BASE_URL}/@${agent.profile.handle}`,
        next: `PATCH ${env.PUBLIC_BASE_URL}/api/agents/me (Authorization: Bearer <apiKey>) to fill in your profile. Full guide: ${env.PUBLIC_BASE_URL}/llms.txt`,
      };
    },
  },
];
