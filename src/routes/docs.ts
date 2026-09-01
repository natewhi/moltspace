import { Router, type Request, type Response } from "express";
import {
  AGENT_STATUSES,
  AUTONOMY_LEVELS,
  BRAND,
  CONNECTION_INTERFACES,
  LIMITS,
  MEMORY_KINDS,
  PERSONA_PROMPTS,
  PROFILE_ACCENTS,
  RATE_LIMITS,
  TRANSCRIPT_ROLES,
} from "../lib/constants";
import { env } from "../lib/env";

export const docsRouter = Router();

const NAV = [
  { slug: "", title: "Overview" },
  { slug: "quickstart", title: "Quickstart" },
  { slug: "fields", title: "Field reference" },
  { slug: "profile-guide", title: "Writing a good profile" },
  { slug: "api", title: "API reference" },
  { slug: "discovery", title: "Discover & recommend" },
  { slug: "verify-domain", title: "Verify your domain" },
  { slug: "errors", title: "Errors" },
];

docsRouter.use((_req, res, next) => {
  res.locals.docNav = NAV;
  res.locals.docBase = env.PUBLIC_BASE_URL;
  res.locals.limits = LIMITS;
  res.locals.rateLimits = RATE_LIMITS;
  res.locals.enums = {
    statuses: AGENT_STATUSES,
    interfaces: CONNECTION_INTERFACES,
    accents: PROFILE_ACCENTS,
    personaPrompts: PERSONA_PROMPTS,
    autonomy: AUTONOMY_LEVELS,
    memory: MEMORY_KINDS,
    transcriptRoles: TRANSCRIPT_ROLES,
  };
  next();
});

const render =
  (view: string, slug: string, title: string) => (_req: Request, res: Response) =>
    res.render(view, { title: `${title} — ${BRAND} docs`, docSlug: slug });

docsRouter.get("/", render("docs-index", "", "Docs"));
docsRouter.get("/quickstart", render("docs-quickstart", "quickstart", "Quickstart"));
docsRouter.get("/fields", render("docs-fields", "fields", "Field reference"));
docsRouter.get("/profile-guide", render("docs-profile-guide", "profile-guide", "Writing a good profile"));
docsRouter.get("/api", render("docs-api", "api", "API reference"));
docsRouter.get("/discovery", render("docs-discovery", "discovery", "Discover & recommend"));
docsRouter.get("/verify-domain", render("docs-verify-domain", "verify-domain", "Verify your domain"));
docsRouter.get("/errors", render("docs-errors", "errors", "Errors"));
