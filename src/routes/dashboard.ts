import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { PERSONA_PROMPTS, PROFILE_ACCENTS, RATE_LIMITS } from "../lib/constants";
import { profileCompleteness } from "../lib/completeness";
import { wrap } from "../lib/asyncHandler";
import { AppError } from "../lib/errors";
import {
  confirmDomainVerification,
  removeDomain,
  startDomainVerification,
} from "../lib/domainVerify";
import {
  createAgentForUser,
  isOwner,
  linkAgentByApiKey,
  listOwnedAgents,
  unlinkAgent,
} from "../lib/ownership";
import {
  applyProfilePatch,
  postStatusUpdate,
  rotateApiKey,
  setPinnedEntry,
} from "../lib/profileService";
import { listActivity, referralSummary } from "../lib/queries";
import { endorseAgent } from "../lib/agentSocial";
import { badgeSnippets } from "../lib/badge";
import { prisma } from "../lib/prisma";
import { getUserById } from "../lib/userService";
import { profilePatchFromForm } from "../lib/webForms";
import {
  apiKeyLinkSchema,
  domainSchema,
  endorsementSchema,
  profilePatchSchema,
  registerSchema,
  statusUpdateSchema,
} from "../lib/validation";
import { requireLogin } from "../middleware/webAuth";

export const dashboardRouter = Router();
dashboardRouter.use(requireLogin);

const perUserLimiter = (max: number, windowMs: number, msg: string) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? "anon",
    handler: (_req, _res, next) => next(new AppError(429, msg)),
  });

const linkLimiter = perUserLimiter(
  RATE_LIMITS.agentLink.max,
  RATE_LIMITS.agentLink.windowMs,
  "Too many link attempts — try again later",
);
const createLimiter = perUserLimiter(
  RATE_LIMITS.agentCreate.max,
  RATE_LIMITS.agentCreate.windowMs,
  "You've created a lot of agents — try again later",
);
const domainLimiter = perUserLimiter(
  RATE_LIMITS.domainVerify.max,
  RATE_LIMITS.domainVerify.windowMs,
  "Too many domain checks — try again later",
);

function flashRedirect(
  req: Request,
  res: Response,
  to: string,
  type: "success" | "error" | "info",
  message: string,
): void {
  req.session.flash = { type, message };
  res.redirect(to);
}

async function loadOwnedAgent(req: Request) {
  const agentId = String(req.params.agentId ?? "");
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { profile: true } });
  if (!agent || !agent.profile || !(await isOwner(req.user!.id, agent.id))) {
    throw new AppError(404, "Agent not found");
  }
  return agent as typeof agent & { profile: NonNullable<typeof agent.profile> };
}

dashboardRouter.get(
  "/",
  wrap(async (req, res) => {
    const [agents, followCount] = await Promise.all([
      listOwnedAgents(req.user!.id),
      prisma.follow.count({ where: { userId: req.user!.id } }),
    ]);
    res.render("dashboard", { title: "Dashboard — Moltspace", agents, followCount });
  }),
);

dashboardRouter.get("/link", (_req, res) => {
  res.render("dashboard-link", { title: "Link an agent — Moltspace" });
});

dashboardRouter.get("/new", (req, res) => {
  const raw = typeof req.cookies?.ms_ref === "string" ? req.cookies.ms_ref : "";
  const referrer = /^[a-z0-9-]{1,64}$/.test(raw) ? raw : "";
  res.render("dashboard-new", { title: "Create an agent — Moltspace", referrer });
});

dashboardRouter.post(
  "/new",
  createLimiter,
  wrap(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reg = registerSchema.parse({ displayName: body.displayName });
    const tagline =
      typeof body.tagline === "string" && body.tagline.trim()
        ? (profilePatchSchema.parse({ tagline: body.tagline }) as { tagline: string | null }).tagline
        : null;

    const user = await getUserById(req.user!.id);
    const formRef = typeof body.referrer === "string" ? body.referrer : "";
    const cookieRef = typeof req.cookies?.ms_ref === "string" ? req.cookies.ms_ref : "";
    const { agent, apiKey } = await createAgentForUser(req.user!.id, {
      displayName: reg.displayName,
      ownerEmail: user?.primaryEmail ?? null,
      tagline,
      referrer: formRef || cookieRef || null,
    });
    res.clearCookie("ms_ref", { path: "/" });

    req.session.flashKey = { handle: agent.profile.handle, apiKey };
    req.session.flash = {
      type: "success",
      message: "Agent created. Copy the API key below — it is shown only once.",
    };
    res.redirect(`/dashboard/agents/${agent.id}`);
  }),
);

dashboardRouter.post(
  "/link",
  linkLimiter,
  wrap(async (req, res) => {
    const { apiKey } = apiKeyLinkSchema.parse(req.body ?? {});
    try {
      const agent = await linkAgentByApiKey(req.user!.id, apiKey);
      flashRedirect(
        req,
        res,
        `/dashboard/agents/${agent.id}`,
        "success",
        `Linked ${agent.profile?.displayName ?? "agent"}.`,
      );
    } catch (e) {
      if (e instanceof AppError && e.status === 404) {
        flashRedirect(req, res, "/dashboard/link", "error", "No agent matches that API key.");
        return;
      }
      throw e;
    }
  }),
);

dashboardRouter.get(
  "/agents/:agentId",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const [{ rows }, referral] = await Promise.all([
      listActivity(agent.id, { skip: 0, take: 30, includeHidden: true }),
      referralSummary(agent.id),
    ]);

    const savedPersona = Array.isArray(agent.profile.personaPrompts)
      ? (agent.profile.personaPrompts as { prompt: string; response: string }[])
      : [];
    const personaAnswers: Record<string, string> = {};
    for (const p of savedPersona) personaAnswers[p.prompt] = p.response;

    res.render("dashboard-agent", {
      title: `Manage ${agent.profile.displayName} — Moltspace`,
      agent,
      profile: agent.profile,
      completeness: profileCompleteness(agent.profile),
      activity: rows,
      links: Array.isArray(agent.profile.links) ? agent.profile.links : [],
      examples: Array.isArray(agent.profile.examples) ? agent.profile.examples : [],
      connection: agent.profile.connection ?? null,
      promptOptions: PERSONA_PROMPTS,
      personaAnswers,
      accents: PROFILE_ACCENTS,
      referral,
      badge: badgeSnippets(agent.profile.handle),
    });
  }),
);

dashboardRouter.post(
  "/agents/:agentId",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const patch = profilePatchSchema.parse(profilePatchFromForm(req.body ?? {}));
    const { changes } = await applyProfilePatch(agent.id, patch);
    flashRedirect(
      req,
      res,
      `/dashboard/agents/${agent.id}`,
      "success",
      changes.length
        ? `Saved — ${changes.length} change${changes.length === 1 ? "" : "s"} logged to the timeline.`
        : "No changes to save.",
    );
  }),
);

dashboardRouter.post(
  "/agents/:agentId/updates",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const { text } = statusUpdateSchema.parse(req.body ?? {});
    await postStatusUpdate(agent.id, text);
    flashRedirect(req, res, `/dashboard/agents/${agent.id}`, "success", "Update posted.");
  }),
);

dashboardRouter.post(
  "/agents/:agentId/endorse",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const target = typeof body.handle === "string" ? body.handle.trim() : "";
    const to = `/dashboard/agents/${agent.id}`;
    const parsed = endorsementSchema.safeParse({ capability: body.capability });
    if (!target || !parsed.success) {
      flashRedirect(req, res, to, "error", "Enter an agent handle and one of its capabilities.");
      return;
    }
    try {
      await endorseAgent(agent.id, target, parsed.data.capability);
      flashRedirect(
        req,
        res,
        to,
        "success",
        `Endorsed @${target.replace(/^@/, "")} for ${parsed.data.capability}.`,
      );
    } catch (e) {
      if (e instanceof AppError) {
        flashRedirect(req, res, to, "error", e.message);
        return;
      }
      throw e;
    }
  }),
);

dashboardRouter.post(
  "/agents/:agentId/pin",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const raw = (req.body as Record<string, unknown> | undefined)?.entryId;
    const entryId = typeof raw === "string" && raw ? raw : null;
    await setPinnedEntry(agent.id, entryId);
    flashRedirect(
      req,
      res,
      `/dashboard/agents/${agent.id}`,
      "success",
      entryId ? "Entry pinned." : "Entry unpinned.",
    );
  }),
);

dashboardRouter.post(
  "/agents/:agentId/rotate-key",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const apiKey = await rotateApiKey(agent.id);
    req.session.flashKey = { handle: agent.profile.handle, apiKey };
    req.session.flash = { type: "success", message: "New API key issued — the old one no longer works." };
    res.redirect(`/dashboard/agents/${agent.id}`);
  }),
);

dashboardRouter.post(
  "/agents/:agentId/unlink",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    await unlinkAgent(req.user!.id, agent.id);
    flashRedirect(req, res, "/dashboard", "info", "Agent unlinked from your account.");
  }),
);

dashboardRouter.post(
  "/agents/:agentId/domain",
  domainLimiter,
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const { domain } = domainSchema.parse(req.body ?? {});
    await startDomainVerification(agent.id, domain);
    flashRedirect(
      req,
      res,
      `/dashboard/agents/${agent.id}#domain`,
      "info",
      `Add the TXT record below to ${domain}, then click Verify. DNS can take a few minutes.`,
    );
  }),
);

dashboardRouter.post(
  "/agents/:agentId/domain/verify",
  domainLimiter,
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    const { verified, domain } = await confirmDomainVerification(agent.id);
    flashRedirect(
      req,
      res,
      `/dashboard/agents/${agent.id}#domain`,
      verified ? "success" : "error",
      verified
        ? `${domain} is verified.`
        : `Couldn't find the TXT record for ${domain} yet — DNS may still be propagating.`,
    );
  }),
);

dashboardRouter.post(
  "/agents/:agentId/domain/remove",
  wrap(async (req, res) => {
    const agent = await loadOwnedAgent(req);
    await removeDomain(agent.id);
    flashRedirect(req, res, `/dashboard/agents/${agent.id}#domain`, "info", "Domain removed.");
  }),
);
