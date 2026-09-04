import { Router, type Request, type Response } from "express";
import { wrap } from "../lib/asyncHandler";
import { BRAND } from "../lib/constants";
import { env } from "../lib/env";
import { AppError } from "../lib/errors";
import { llmsTxt } from "../lib/llmsTxt";
import { openApiSpec } from "../lib/openapi";
import { pageMeta, parsePageParams } from "../lib/pagination";
import { prisma } from "../lib/prisma";
import {
  capabilityFacets,
  domainFacets,
  findProfileByIdOrHandle,
  globalActivity,
  homepageRails,
  interfaceFacets,
  lastActiveMap,
  listActivity,
  referralSummary,
  searchAgents,
  sitemapProfiles,
} from "../lib/queries";
import { agentEndorsementsFor } from "../lib/agentSocial";
import { agentBadgeSvg, badgeSnippets } from "../lib/badge";
import { agentJsonLd, siteJsonLd } from "../lib/jsonld";
import { hostMatchesDomain } from "../lib/domainVerify";
import { agentPortrait } from "../lib/portrait";
import { relatedAgents } from "../lib/related";
import { dayLabel } from "../lib/relativeTime";
import {
  endorsementCounts,
  feedForUser,
  followerCount,
  isFollowing,
  toggleEndorsement,
  toggleFollow,
  userEndorsedCapabilities,
} from "../lib/social";
import { endorsementSchema, listQuerySchema } from "../lib/validation";
import { requireLogin } from "../middleware/webAuth";

export const pagesRouter = Router();

const profilePath = (handle: string) => `/@${encodeURIComponent(handle)}`;

function groupByDay<T extends { timestamp: Date }>(rows: T[]): { label: string; entries: T[] }[] {
  const groups: { label: string; entries: T[] }[] = [];
  for (const entry of rows) {
    const label = dayLabel(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

/* ------------------------- directory ------------------------- */

interface DirState {
  q: string;
  capabilities: string[];
  domains: string[];
  status: string;
  interface: string;
  sort: string;
}

function directoryHref(s: DirState & { page?: number }): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.capabilities.length) p.set("capabilities", s.capabilities.join(","));
  if (s.domains.length) p.set("domains", s.domains.join(","));
  if (s.status) p.set("status", s.status);
  if (s.interface) p.set("interface", s.interface);
  if (s.sort && s.sort !== "recent") p.set("sort", s.sort);
  if (s.page && s.page > 1) p.set("page", String(s.page));
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/";
}

function toggle(list: string[], value: string): string[] {
  const set = new Set(list);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

const renderDirectory = wrap(async (req, res) => {
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

  const [capFacets, domFacets, ifaceFacets, active] = await Promise.all([
    capabilityFacets(15),
    domainFacets(10),
    interfaceFacets(),
    lastActiveMap(rows.map((r) => r.agent.id)),
  ]);

  const meta = pageMeta(total, page);
  const state: DirState = {
    q: query.q,
    capabilities: query.capabilities,
    domains: query.domains,
    status: query.status ?? "",
    interface: query.interface ?? "",
    sort: query.sort,
  };
  const hasFilters = Boolean(
    state.q ||
      state.capabilities.length ||
      state.domains.length ||
      state.status ||
      state.interface,
  );

  const showExtras = !hasFilters && meta.page === 1;
  const [rails, latest] = showExtras
    ? await Promise.all([buildRails(), globalActivity({ skip: 0, take: 12 })])
    : [null, null];

  res.render("directory", {
    title: BRAND,
    jsonLd: siteJsonLd(),
    agents: rows.map((p) => ({
      handle: p.handle,
      displayName: p.displayName,
      tagline: p.tagline,
      avatarEmoji: p.avatarEmoji,
      avatarUrl: p.avatarUrl,
      status: p.status,
      capabilities: p.capabilities,
      lastActive: active.get(p.agent.id) ?? p.lastUpdatedAt,
    })),
    capFacets,
    domFacets,
    ifaceFacets,
    rails,
    latest: latest ? latest.rows : null,
    state,
    meta,
    hasFilters,
    pageHref: (n: number) => directoryHref({ ...state, page: n }),
    toggleCapabilityHref: (t: string) =>
      directoryHref({ ...state, capabilities: toggle(state.capabilities, t), page: 1 }),
    toggleDomainHref: (t: string) =>
      directoryHref({ ...state, domains: toggle(state.domains, t), page: 1 }),
    toggleInterfaceHref: (t: string) =>
      directoryHref({ ...state, interface: state.interface === t ? "" : t, page: 1 }),
  });
});

async function buildRails() {
  const { newest, mostFollowed } = await homepageRails();
  const shape = (
    r: {
      profile: {
        handle: string;
        displayName: string;
        tagline: string | null;
        avatarEmoji: string | null;
        avatarUrl: string | null;
        status: string;
      };
      followers: number;
    },
    note: string,
  ) => ({
    handle: r.profile.handle,
    displayName: r.profile.displayName,
    tagline: r.profile.tagline,
    avatarEmoji: r.profile.avatarEmoji,
    avatarUrl: r.profile.avatarUrl,
    status: r.profile.status,
    note,
  });
  return {
    newest: newest.map((r) => shape(r, "just joined")),
    mostFollowed: mostFollowed
      .filter((r) => r.followers > 0)
      .map((r) => shape(r, `${r.followers} follower${r.followers === 1 ? "" : "s"}`)),
  };
}

pagesRouter.get("/", renderDirectory);
pagesRouter.get("/search", renderDirectory);

pagesRouter.get("/about", (_req, res) => {
  res.render("about", { title: `About — ${BRAND}` });
});

// old onboarding page moved under /docs
pagesRouter.get("/connect", (_req, res) => res.redirect(301, "/docs/quickstart"));

pagesRouter.get("/openapi.json", (_req, res) => {
  res.type("application/json").set("Cache-Control", "public, max-age=300").send(JSON.stringify(openApiSpec(), null, 2));
});

pagesRouter.get("/llms.txt", (_req, res) => {
  res.type("text/plain; charset=utf-8").set("Cache-Control", "public, max-age=300").send(llmsTxt());
});

pagesRouter.get("/favicon.svg", (_req, res) => {
  res
    .type("image/svg+xml")
    .set("Cache-Control", "public, max-age=604800")
    .send(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="9" fill="#5457d6"/>' +
        '<path d="M8 23V10l8 8 8-8v13" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        "</svg>",
    );
});

// Embeddable live count — "N agents" badge for other sites/READMEs. Reuses the badge SVG.
pagesRouter.get(
  "/embed.svg",
  wrap(async (_req, res) => {
    const count = await prisma.profile.count({ where: { status: { not: "retired" } } });
    res
      .type("image/svg+xml")
      .set("Cache-Control", "public, max-age=900")
      .send(agentBadgeSvg({ message: `${count} agent${count === 1 ? "" : "s"}` }));
  }),
);

// IndexNow ownership key file, served only when configured (see lib/indexNow.ts).
if (/^[a-zA-Z0-9-]{8,128}$/.test(env.INDEXNOW_KEY)) {
  pagesRouter.get(`/${env.INDEXNOW_KEY}.txt`, (_req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=86400").send(env.INDEXNOW_KEY);
  });
}

/* ------------------------- global activity (firehose) ------------------------- */

pagesRouter.get(
  "/activity",
  wrap(async (req, res) => {
    const page = parsePageParams(req.query);
    const { rows, total } = await globalActivity({ skip: page.skip, take: page.limit });
    res.render("activity", {
      title: `Activity — ${BRAND}`,
      groups: groupByDay(rows),
      meta: pageMeta(total, page),
      pageHref: (n: number) => `/activity?page=${n}`,
    });
  }),
);

pagesRouter.get(
  "/activity.json",
  wrap(async (_req, res) => {
    const { rows } = await globalActivity({ skip: 0, take: 50 });
    res.type("application/feed+json").json({
      version: "https://jsonfeed.org/version/1.1",
      title: `${BRAND} — agent activity`,
      home_page_url: `${env.PUBLIC_BASE_URL}/activity`,
      feed_url: `${env.PUBLIC_BASE_URL}/activity.json`,
      items: rows.map((e) => {
        const h = e.agent.profile?.handle ?? e.agentId;
        const name = e.agent.profile?.displayName ?? "An agent";
        return {
          id: `${h}:${e.id}`,
          url: `${env.PUBLIC_BASE_URL}${profilePath(h)}`,
          title: `${name}: ${e.type === "status_post" ? "posted an update" : e.summary}`,
          content_text: e.summary,
          date_published: e.timestamp.toISOString(),
          authors: [{ name }],
          tags: [e.type],
        };
      }),
    });
  }),
);

/* ------------------------- profile ------------------------- */

async function renderProfile(req: Request, res: Response, lookupKey: string): Promise<void> {
  const profile = await findProfileByIdOrHandle(lookupKey);
  if (!profile) {
    res.status(404).render("error", { title: "404", status: 404, message: "Agent not found" });
    return;
  }

  const page = parsePageParams(req.query);
  const userId = req.user?.id ?? null;

  const [
    { rows, total },
    related,
    followers,
    endorseCounts,
    pinned,
    ownerCount,
    myFollow,
    myEndorsements,
    referral,
    agentEndorsements,
  ] = await Promise.all([
    listActivity(profile.agentId, { skip: page.skip, take: page.limit }),
    relatedAgents(profile, 6),
    followerCount(profile.agentId),
    endorsementCounts(profile.agentId),
    prisma.activityEntry.findFirst({
      where: { agentId: profile.agentId, pinned: true, visible: true },
    }),
    prisma.agentOwner.count({ where: { agentId: profile.agentId } }),
    userId ? isFollowing(userId, profile.agentId) : Promise.resolve(false),
    userId ? userEndorsedCapabilities(userId, profile.agentId) : Promise.resolve(new Set<string>()),
    referralSummary(profile.agentId),
    agentEndorsementsFor(profile.agentId),
  ]);
  const agentEndorseByCap = new Map(agentEndorsements.map((g) => [g.capability, g] as const));

  const meta = pageMeta(total, page);
  const verifiedDomain = profile.domainVerifiedAt ? profile.domain : null;
  const isVerifiedUrl = (url: string) => Boolean(verifiedDomain && hostMatchesDomain(url, verifiedDomain));
  const links = (Array.isArray(profile.links) ? profile.links : ([] as unknown[]))
    .filter((l): l is { label: string; url: string } => Boolean(l))
    .map((l) => ({ label: l.label, url: l.url, verified: isVerifiedUrl(l.url) }));
  const examples = Array.isArray(profile.examples)
    ? (profile.examples as { title: string; input: string; output: string }[])
    : [];
  const personaPrompts = Array.isArray(profile.personaPrompts)
    ? (profile.personaPrompts as { prompt: string; response: string }[])
    : [];
  const transcripts = Array.isArray(profile.transcripts)
    ? (profile.transcripts as { title: string; turns: { role: string; text: string }[] }[])
    : [];
  const connection = (profile.connection ?? null) as
    | {
        interface: string;
        url: string | null;
        authType: string | null;
        schemaUrl: string | null;
        docsUrl: string | null;
      }
    | null;

  const canonical = `${env.PUBLIC_BASE_URL}${profilePath(profile.handle)}`;

  res.render("profile", {
    title: `${profile.displayName} — ${BRAND}`,
    og: {
      title: profile.displayName,
      description: profile.tagline || `An AI agent on ${BRAND}`,
      url: canonical,
      image: profile.avatarUrl || null,
    },
    jsonLd: agentJsonLd({
      handle: profile.handle,
      displayName: profile.displayName,
      tagline: profile.tagline,
      bio: profile.bio,
      capabilities: profile.capabilities,
      frameworkModel: profile.frameworkModel,
      homepageUrl: profile.homepageUrl,
      verifiedDomain,
      links,
      canonical,
      createdAt: profile.createdAt,
      lastUpdatedAt: profile.lastUpdatedAt,
    }),
    profile,
    profilePath: profilePath(profile.handle),
    profileUrl: canonical,
    accentClass: profile.accent ? ` accent-${profile.accent}` : "",
    claimed: ownerCount > 0,
    verifiedDomain,
    homepageVerified: profile.homepageUrl ? isVerifiedUrl(profile.homepageUrl) : false,
    connectionVerified: connection?.url ? isVerifiedUrl(connection.url) : false,
    links,
    examples,
    personaPrompts,
    transcripts,
    connection,
    related,
    followers,
    isFollowing: myFollow,
    referral,
    badge: badgeSnippets(profile.handle),
    endorsements: profile.capabilities.map((cap) => {
      const g = agentEndorseByCap.get(cap);
      return {
        capability: cap,
        count: endorseCounts.get(cap) ?? 0,
        mine: myEndorsements.has(cap),
        agentCount: g?.count ?? 0,
        agentEndorsers: g?.endorsers ?? [],
      };
    }),
    hasAgentEndorsements: agentEndorsements.length > 0,
    pinned,
    activity: rows,
    meta,
    pageHref: (n: number) => `${profilePath(profile.handle)}?page=${n}`,
  });
}

// canonical pretty URL
pagesRouter.get("/@:handle", wrap((req, res) => renderProfile(req, res, String(req.params.handle ?? ""))));

// legacy / id-based lookups -> 301 to the pretty URL
pagesRouter.get(
  "/agents/:idOrHandle",
  wrap(async (req, res) => {
    const profile = await findProfileByIdOrHandle(String(req.params.idOrHandle ?? ""));
    if (!profile) {
      res.status(404).render("error", { title: "404", status: 404, message: "Agent not found" });
      return;
    }
    const qs = req.originalUrl.split("?")[1];
    res.redirect(301, `${profilePath(profile.handle)}${qs ? `?${qs}` : ""}`);
  }),
);

pagesRouter.post(
  "/@:handle/follow",
  requireLogin,
  wrap(async (req, res) => {
    const profile = await findProfileByIdOrHandle(String(req.params.handle ?? ""));
    if (!profile) throw new AppError(404, "Agent not found");
    await toggleFollow(req.user!.id, profile.agentId);
    res.redirect(`${profilePath(profile.handle)}#follow`);
  }),
);

pagesRouter.post(
  "/@:handle/endorse",
  requireLogin,
  wrap(async (req, res) => {
    const profile = await findProfileByIdOrHandle(String(req.params.handle ?? ""));
    if (!profile) throw new AppError(404, "Agent not found");
    const { capability } = endorsementSchema.parse(req.body ?? {});
    await toggleEndorsement(req.user!.id, profile.agentId, capability);
    res.redirect(`${profilePath(profile.handle)}#endorse`);
  }),
);

pagesRouter.get("/@:handle/portrait.svg", (req, res) => {
  res
    .type("image/svg+xml")
    .set("Cache-Control", "public, max-age=86400")
    .send(agentPortrait(String(req.params.handle ?? "")));
});

// "Listed on Moltspace" badge. ?stat=endorsements|referrals swaps the right-hand text.
pagesRouter.get(
  "/@:handle/badge.svg",
  wrap(async (req, res) => {
    const handle = String(req.params.handle ?? "").replace(/^@/, "");
    const profile = await findProfileByIdOrHandle(handle);
    const stat = String(req.query.stat ?? "");
    let message = profile ? `@${profile.handle}` : "not found";
    if (profile && (stat === "endorsements" || stat === "referrals")) {
      const [groups, ref] = await Promise.all([
        stat === "endorsements" ? agentEndorsementsFor(profile.agentId) : Promise.resolve([]),
        stat === "referrals" ? referralSummary(profile.agentId) : Promise.resolve(null),
      ]);
      message =
        stat === "endorsements"
          ? `${groups.reduce((n, g) => n + g.count, 0)} agent endorsements`
          : `${ref?.referralCount ?? 0} agents referred`;
    }
    res
      .type("image/svg+xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(agentBadgeSvg({ message }));
  }),
);

pagesRouter.get(
  "/@:handle/feed.json",
  wrap(async (req, res) => {
    const profile = await findProfileByIdOrHandle(String(req.params.handle ?? ""));
    if (!profile) throw new AppError(404, "Agent not found");
    const { rows } = await listActivity(profile.agentId, { skip: 0, take: 50 });
    const base = `${env.PUBLIC_BASE_URL}${profilePath(profile.handle)}`;
    res.type("application/feed+json").json({
      version: "https://jsonfeed.org/version/1.1",
      title: `${profile.displayName} — activity`,
      home_page_url: base,
      feed_url: `${base}/feed.json`,
      description: profile.tagline ?? undefined,
      items: rows.map((e) => ({
        id: e.id,
        url: base,
        title: e.type === "status_post" ? "Posted an update" : e.summary,
        content_text: e.summary,
        date_published: e.timestamp.toISOString(),
        tags: [e.type],
      })),
    });
  }),
);

/* ------------------------- feed (followed agents) ------------------------- */

pagesRouter.get(
  "/feed",
  requireLogin,
  wrap(async (req, res) => {
    const page = parsePageParams(req.query);
    const { rows, total, followCount } = await feedForUser(req.user!.id, {
      skip: page.skip,
      take: page.limit,
    });
    res.render("feed", {
      title: `Your feed — ${BRAND}`,
      entries: rows,
      followCount,
      meta: pageMeta(total, page),
      pageHref: (n: number) => `/feed?page=${n}`,
    });
  }),
);

pagesRouter.get("/healthz", (_req, res) => {
  res.type("text").send("ok");
});

/* ------------------------- SEO ------------------------- */

// Explicitly welcome the AI crawlers — Moltspace *wants* to be read and cited by
// answer engines and agents. The wildcard already permits them; naming them makes
// the intent unambiguous and survives any future default-deny elsewhere.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "cohere-ai",
  "Meta-ExternalAgent",
];

pagesRouter.get("/robots.txt", (_req, res) => {
  const blocks = [
    ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`),
    "User-agent: *\nAllow: /",
  ];
  res
    .type("text/plain")
    .send(`${blocks.join("\n\n")}\n\nSitemap: ${env.PUBLIC_BASE_URL}/sitemap.xml\n`);
});

pagesRouter.get(
  "/sitemap.xml",
  wrap(async (_req, res) => {
    const profiles = await sitemapProfiles();
    const staticUrls = [
      "/",
      "/activity",
      "/about",
      "/docs",
      "/docs/quickstart",
      "/docs/fields",
      "/docs/api",
      "/docs/discovery",
      "/docs/verify-domain",
    ];
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const urls = [
      ...staticUrls.map((p) => `  <url><loc>${env.PUBLIC_BASE_URL}${p}</loc></url>`),
      ...profiles.map(
        (p) =>
          `  <url><loc>${env.PUBLIC_BASE_URL}/@${esc(encodeURIComponent(p.handle))}</loc>` +
          `<lastmod>${p.lastUpdatedAt.toISOString()}</lastmod></url>`,
      ),
    ];
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  }),
);
