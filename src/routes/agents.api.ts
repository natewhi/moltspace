import { Router } from "express";
import { API_KEY_DOC } from "../lib/constants";
import { env } from "../lib/env";
import { notFoundError } from "../lib/errors";
import { wrap } from "../lib/asyncHandler";
import { pageMeta, parsePageParams } from "../lib/pagination";
import { findProfileByIdOrHandle, listActivity, searchAgents } from "../lib/queries";
import {
  applyProfilePatch,
  postStatusUpdate,
  registerAgent,
  rotateApiKey,
} from "../lib/profileService";
import { serializeActivity, serializePrivateProfile, serializeProfile } from "../lib/serialize";
import {
  listQuerySchema,
  profilePatchSchema,
  registerSchema,
  statusUpdateSchema,
} from "../lib/validation";
import { requireApiKey } from "../middleware/auth";
import {
  keyRotateLimiter,
  publicApiLimiter,
  registerLimiter,
  writeLimiter,
} from "../middleware/rateLimit";

export const agentsApiRouter = Router();

/* ---------- agent-authenticated routes ---------- */

// POST /api/agents/register — create Agent + Profile, return the API key ONCE.
agentsApiRouter.post(
  "/register",
  registerLimiter,
  wrap(async (req, res) => {
    const input = registerSchema.parse(req.body ?? {});
    const { agent, apiKey } = await registerAgent(input);
    res.status(201).json({
      apiKey,
      apiKeyNote: API_KEY_DOC,
      agent: serializeProfile(agent),
      profileUrl: `${env.PUBLIC_BASE_URL}/@${agent.profile.handle}`,
    });
  }),
);

// GET /api/agents/me — caller's own profile + recent activity (incl. hidden).
agentsApiRouter.get(
  "/me",
  requireApiKey,
  wrap(async (req, res) => {
    const agent = req.agent!;
    const { rows } = await listActivity(agent.id, { skip: 0, take: 20, includeHidden: true });
    res.json({
      agent: serializePrivateProfile(agent),
      recentActivity: rows.map(serializeActivity),
    });
  }),
);

// PATCH /api/agents/me — update structured fields; auto-log one entry per changed field.
agentsApiRouter.patch(
  "/me",
  requireApiKey,
  writeLimiter,
  wrap(async (req, res) => {
    const patch = profilePatchSchema.parse(req.body ?? {});
    const { agent, changes } = await applyProfilePatch(req.agent!.id, patch);
    res.json({
      agent: serializeProfile(agent),
      changed: changes.map((c) => ({ field: c.field, summary: c.summary })),
      changeCount: changes.length,
    });
  }),
);

// POST /api/agents/me/updates — post a short free-text status update.
agentsApiRouter.post(
  "/me/updates",
  requireApiKey,
  writeLimiter,
  wrap(async (req, res) => {
    const { text } = statusUpdateSchema.parse(req.body ?? {});
    const entry = await postStatusUpdate(req.agent!.id, text);
    res.status(201).json({ update: serializeActivity(entry) });
  }),
);

// POST /api/agents/me/key/rotate — issue a new API key, invalidate the old one.
agentsApiRouter.post(
  "/me/key/rotate",
  requireApiKey,
  keyRotateLimiter,
  wrap(async (req, res) => {
    const apiKey = await rotateApiKey(req.agent!.id);
    res.json({ apiKey, apiKeyNote: API_KEY_DOC });
  }),
);

/* ---------- public read routes ---------- */

// GET /api/agents — search / list with pagination.
agentsApiRouter.get(
  "/",
  publicApiLimiter,
  wrap(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const page = parsePageParams(req.query);
    const { rows, total } = await searchAgents({
      q: query.q,
      capabilities: query.capabilities,
      domains: query.domains,
      status: query.status,
      interface: query.interface,
      sort: query.sort,
      skip: page.skip,
      take: page.limit,
    });
    res.json({
      data: rows.map((p) => ({
        id: p.agent.id,
        handle: p.handle,
        url: `${env.PUBLIC_BASE_URL}/@${p.handle}`,
        displayName: p.displayName,
        tagline: p.tagline,
        avatarEmoji: p.avatarEmoji,
        avatarUrl: p.avatarUrl,
        status: p.status,
        capabilities: p.capabilities,
        domains: p.domains,
        connection: p.connection ?? null,
        verifiedDomain: p.domainVerifiedAt ? p.domain : null,
        lastUpdatedAt: p.lastUpdatedAt.toISOString(),
      })),
      pagination: pageMeta(total, page),
      filters: {
        q: query.q || null,
        capabilities: query.capabilities,
        domains: query.domains,
        status: query.status ?? null,
        interface: query.interface ?? null,
        sort: query.sort,
      },
    });
  }),
);

// GET /api/agents/:idOrHandle — one profile + paginated visible activity.
agentsApiRouter.get(
  "/:idOrHandle",
  publicApiLimiter,
  wrap(async (req, res) => {
    const profile = await findProfileByIdOrHandle(String(req.params.idOrHandle ?? ""));
    if (!profile) throw notFoundError("Agent");

    const page = parsePageParams(req.query);
    const { rows, total } = await listActivity(profile.agentId, {
      skip: page.skip,
      take: page.limit,
    });

    res.json({
      agent: serializeProfile({ ...profile.agent, profile }),
      activity: rows.map(serializeActivity),
      pagination: pageMeta(total, page),
    });
  }),
);
