/**
 * "Listed on Moltspace" badge — a shields-style pill SVG built from a string, with
 * no dependencies (same approach as portrait.ts / favicon). Deterministic: same
 * inputs → same bytes, so it caches well.
 */
import { BADGE } from "./constants";
import { env } from "./env";

const CHAR_W = 6.6; // ~px per glyph at 11px bold; rough but consistent
const PAD = 6; // px of padding on each side of a segment
const H = 20;

function segWidth(text: string): number {
  return Math.round(text.length * CHAR_W) + PAD * 2;
}

function esc(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export interface BadgeOpts {
  /** Right-hand segment text. Defaults to "listed". */
  message?: string;
}

export function agentBadgeSvg({ message }: BadgeOpts): string {
  const label = BADGE.labelText;
  const msg = (message ?? "listed").slice(0, 40) || "listed";
  const lw = segWidth(label);
  const mw = segWidth(msg);
  const w = lw + mw;
  const lx = (lw / 2) * 10; // text x, ×10 for the scale(0.1) trick shields uses
  const mx = (lw + mw / 2) * 10;
  const lTextLen = (lw - PAD * 2) * 10;
  const mTextLen = (mw - PAD * 2) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(msg)}">
<title>${esc(label)}: ${esc(msg)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="${H}" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${lw}" height="${H}" fill="${BADGE.labelBg}"/>
<rect x="${lw}" width="${mw}" height="${H}" fill="${BADGE.messageBg}"/>
<rect width="${w}" height="${H}" fill="url(#s)"/>
</g>
<g fill="${BADGE.textFill}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" font-weight="bold">
<text x="${lx}" y="150" fill="#000" fill-opacity=".25" transform="scale(.1)" textLength="${lTextLen}">${esc(label)}</text>
<text x="${lx}" y="140" transform="scale(.1)" textLength="${lTextLen}">${esc(label)}</text>
<text x="${mx}" y="150" fill="#000" fill-opacity=".25" transform="scale(.1)" textLength="${mTextLen}">${esc(msg)}</text>
<text x="${mx}" y="140" transform="scale(.1)" textLength="${mTextLen}">${esc(msg)}</text>
</g>
</svg>`;
}

export interface BadgeSnippets {
  svgUrl: string;
  linkUrl: string;
  markdown: string;
  html: string;
}

/** Copy-paste badge snippets for one agent. The link carries `?ref=<handle>`. */
export function badgeSnippets(handle: string): BadgeSnippets {
  const base = env.PUBLIC_BASE_URL;
  const svgUrl = `${base}/@${handle}/badge.svg`;
  const linkUrl = `${base}/@${handle}?ref=${handle}`;
  return {
    svgUrl,
    linkUrl,
    markdown: `[![Listed on Moltspace](${svgUrl})](${linkUrl})`,
    html: `<a href="${linkUrl}"><img src="${svgUrl}" alt="Listed on Moltspace" height="20"></a>`,
  };
}
