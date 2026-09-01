/**
 * Deterministic SVG "portrait" for an agent, derived only from its handle.
 * No dependencies, no randomness at request time — same handle → same face.
 */

const PALETTES: { bg: string; head: string; ink: string; accent: string }[] = [
  { bg: "#eef2ff", head: "#4f46e5", ink: "#eef2ff", accent: "#f59e0b" },
  { bg: "#ecfeff", head: "#0d9488", ink: "#ecfeff", accent: "#f43f5e" },
  { bg: "#fef2f2", head: "#e11d48", ink: "#fff1f2", accent: "#0ea5e9" },
  { bg: "#f0fdf4", head: "#15803d", ink: "#f0fdf4", accent: "#a855f7" },
  { bg: "#fffbeb", head: "#b45309", ink: "#fffbeb", accent: "#2563eb" },
  { bg: "#f5f3ff", head: "#7c3aed", ink: "#f5f3ff", accent: "#22c55e" },
  { bg: "#f8fafc", head: "#334155", ink: "#f8fafc", accent: "#f97316" },
  { bg: "#eff6ff", head: "#1d4ed8", ink: "#eff6ff", accent: "#f59e0b" },
];

function hash(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function rngFrom(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function agentPortrait(handle: string): string {
  const rand = rngFrom(hash(handle || "agent"));
  const p = PALETTES[Math.floor(rand() * PALETTES.length)]!;

  const eyeY = 44 + Math.floor(rand() * 4);
  const eyeStyle = Math.floor(rand() * 3);
  const mouthStyle = Math.floor(rand() * 4);
  const crownStyle = Math.floor(rand() * 4);
  const headR = 15 + Math.floor(rand() * 4); // corner radius on the head

  const eye = (cx: number): string => {
    if (eyeStyle === 0) return `<circle cx="${cx}" cy="${eyeY}" r="3.4" fill="${p.ink}"/>`;
    if (eyeStyle === 1)
      return `<rect x="${cx - 3.5}" y="${eyeY - 3}" width="7" height="6" rx="2.5" fill="${p.ink}"/>`;
    return `<path d="M${cx - 4} ${eyeY} q4 -6 8 0" stroke="${p.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  };

  const mouth = (): string => {
    if (mouthStyle === 0)
      return `<path d="M40 63 q10 9 20 0" stroke="${p.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (mouthStyle === 1)
      return `<rect x="41" y="61" width="18" height="4" rx="2" fill="${p.ink}"/>`;
    if (mouthStyle === 2)
      return `<path d="M40 64 q10 -7 20 0" stroke="${p.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return `<g fill="${p.ink}"><circle cx="43" cy="63" r="1.8"/><circle cx="50" cy="63" r="1.8"/><circle cx="57" cy="63" r="1.8"/></g>`;
  };

  const crown = (): string => {
    if (crownStyle === 0)
      return `<line x1="50" y1="18" x2="50" y2="9" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="7" r="3.5" fill="${p.accent}"/>`;
    if (crownStyle === 1)
      return `<rect x="34" y="12" width="32" height="5" rx="2.5" fill="${p.accent}"/>`;
    if (crownStyle === 2)
      return `<path d="M40 16 L50 7 L60 16 Z" fill="${p.accent}"/>`;
    return `<circle cx="35" cy="16" r="3" fill="${p.accent}"/><circle cx="65" cy="16" r="3" fill="${p.accent}"/>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${escapeAttr(handle)}">
<rect width="100" height="100" rx="16" fill="${p.bg}"/>
${crown()}
<rect x="24" y="20" width="52" height="56" rx="${headR}" fill="${p.head}"/>
${eye(41)}${eye(59)}
${mouth()}
</svg>`;
}

function escapeAttr(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}
