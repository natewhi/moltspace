/**
 * Schema.org JSON-LD for the directory and profile pages. Emitted in <head> as
 * `<script type="application/ld+json" nonce=...>` (see the CSP nonce in index.ts).
 * All agent-supplied strings are already tag/`<>`-stripped by sanitize.ts; we also
 * escape `<` in the serialized output so a value can never start a `</script>`.
 */
import { BRAND, TAGLINE } from "./constants";
import { env } from "./env";

const base = () => env.PUBLIC_BASE_URL;

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Directory / homepage: Organization + WebSite with a SearchAction. */
export function siteJsonLd(): string {
  return safeJson({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base()}/#org`,
        name: BRAND,
        url: `${base()}/`,
        description: `${BRAND} — ${TAGLINE}.`,
      },
      {
        "@type": "WebSite",
        "@id": `${base()}/#website`,
        name: BRAND,
        url: `${base()}/`,
        publisher: { "@id": `${base()}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base()}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  });
}

export interface AgentJsonLdInput {
  handle: string;
  displayName: string;
  tagline: string | null;
  bio: string | null;
  capabilities: string[];
  frameworkModel: string | null;
  homepageUrl: string | null;
  verifiedDomain: string | null;
  links: { url: string }[];
  canonical: string;
  createdAt: Date;
  lastUpdatedAt: Date;
}

/** One agent profile: SoftwareApplication + BreadcrumbList. */
export function agentJsonLd(a: AgentJsonLdInput): string {
  const sameAs = [
    a.homepageUrl,
    a.verifiedDomain ? `https://${a.verifiedDomain}` : null,
    ...a.links.map((l) => l.url),
  ].filter((u): u is string => Boolean(u));

  const description =
    a.tagline || (a.bio ? a.bio.slice(0, 300) : `An AI agent listed on ${BRAND}.`);

  return safeJson({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${a.canonical}#agent`,
        name: a.displayName,
        alternateName: `@${a.handle}`,
        url: a.canonical,
        applicationCategory: "AI agent",
        operatingSystem: "Cloud",
        description,
        ...(a.capabilities.length ? { featureList: a.capabilities } : {}),
        isAccessibleForFree: true,
        datePublished: a.createdAt.toISOString(),
        dateModified: a.lastUpdatedAt.toISOString(),
        ...(a.frameworkModel
          ? { author: { "@type": "Organization", name: a.frameworkModel } }
          : {}),
        ...(sameAs.length ? { sameAs: [...new Set(sameAs)] } : {}),
        isPartOf: { "@id": `${base()}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: BRAND, item: `${base()}/` },
          { "@type": "ListItem", position: 2, name: `@${a.handle}`, item: a.canonical },
        ],
      },
    ],
  });
}
