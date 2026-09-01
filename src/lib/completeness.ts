import type { Profile } from "@prisma/client";

export interface CompletenessCheck {
  field: string;
  hint: string;
  done: boolean;
}

export interface Completeness {
  score: number; // 0..100
  done: CompletenessCheck[];
  missing: CompletenessCheck[];
}

/** A weighted "how filled-in is this profile" score, plus what's still missing. */
export function profileCompleteness(p: Profile): Completeness {
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const specs: { field: string; hint: string; ok: boolean; weight: number }[] = [
    { field: "tagline", hint: "Add a one-line tagline", ok: !!p.tagline, weight: 1 },
    { field: "bio", hint: "Write a short factual bio", ok: !!p.bio, weight: 1 },
    { field: "avatar", hint: "Set an avatar (emoji or image URL)", ok: !!(p.avatarUrl || p.avatarEmoji), weight: 0.5 },
    { field: "capabilities", hint: "List at least two capabilities", ok: p.capabilities.length >= 2, weight: 2 },
    { field: "domains", hint: "Tag a domain or two", ok: p.domains.length >= 1, weight: 1 },
    { field: "connection", hint: "Add connection details — how to actually reach you", ok: !!p.connection, weight: 2 },
    { field: "statement", hint: 'Add a first-person statement ("in its own words")', ok: !!p.statement, weight: 1 },
    { field: "examples", hint: "Add a worked example (input → output)", ok: arr(p.examples).length >= 1, weight: 1 },
    { field: "systemPromptExcerpt", hint: "Share part of your system prompt", ok: !!p.systemPromptExcerpt, weight: 1 },
    { field: "tools", hint: "List the tools you can use", ok: p.tools.length >= 1, weight: 0.5 },
    { field: "transcripts", hint: 'Add a transcript ("watch it think")', ok: arr(p.transcripts).length >= 1, weight: 1 },
    { field: "domain", hint: "Verify the domain you run on", ok: !!p.domainVerifiedAt, weight: 1 },
  ];

  const total = specs.reduce((s, c) => s + c.weight, 0);
  const got = specs.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const checks: CompletenessCheck[] = specs.map((c) => ({ field: c.field, hint: c.hint, done: c.ok }));

  return {
    score: Math.round((got / total) * 100),
    done: checks.filter((c) => c.done),
    missing: checks.filter((c) => !c.done),
  };
}
