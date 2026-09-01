import type { Profile } from "@prisma/client";
import type { ProfilePatchInput } from "./validation";

export interface ProfileChange {
  field: string;
  summary: string;
  oldValue: unknown;
  newValue: unknown;
}

const SCALAR_SUMMARIES: Record<string, string> = {
  displayName: "Changed display name",
  tagline: "Changed tagline",
  bio: "Updated bio",
  statement: "Updated statement",
  accent: "Changed profile accent",
  frameworkModel: "Updated framework / model",
  homepageUrl: "Changed homepage URL",
  systemPromptExcerpt: "Updated system-prompt excerpt",
  autonomy: "Changed autonomy level",
  memory: "Changed memory model",
};

const SCALAR_FIELDS = [
  "displayName",
  "tagline",
  "bio",
  "statement",
  "accent",
  "frameworkModel",
  "homepageUrl",
  "avatarEmoji",
  "avatarUrl",
  "systemPromptExcerpt",
  "autonomy",
  "memory",
] as const;

/**
 * Diff a validated patch against the current profile. Returns one entry per
 * meaningfully changed field (used to create ActivityEntry rows).
 */
export function computeProfileChanges(current: Profile, patch: ProfilePatchInput): ProfileChange[] {
  const changes: ProfileChange[] = [];
  const p = patch as Record<string, unknown>;
  const cur = current as unknown as Record<string, unknown>;

  for (const field of SCALAR_FIELDS) {
    if (!(field in p)) continue;
    const next = (p[field] ?? null) as string | null;
    const prev = (cur[field] ?? null) as string | null;
    if (next === prev) continue;
    changes.push({
      field,
      summary:
        field === "avatarEmoji" || field === "avatarUrl"
          ? "Updated avatar"
          : SCALAR_SUMMARIES[field] ?? `Updated ${field}`,
      oldValue: prev,
      newValue: next,
    });
  }

  if ("status" in p && typeof p.status === "string" && p.status !== current.status) {
    changes.push({
      field: "status",
      summary: `Changed status from ${current.status} to ${p.status}`,
      oldValue: current.status,
      newValue: p.status,
    });
  }

  for (const field of ["capabilities", "domains", "tools"] as const) {
    if (field in p && Array.isArray(p[field])) {
      const next = [...(p[field] as string[])];
      const prev = [...((cur[field] as string[]) ?? [])];
      if (!sameSet(prev, next)) {
        changes.push({ field, summary: `Updated ${field}`, oldValue: prev, newValue: next });
      }
    }
  }

  for (const [field, summary] of [
    ["links", "Updated links"],
    ["examples", "Updated examples"],
    ["personaPrompts", "Updated personality answers"],
    ["connection", "Updated connection details"],
    ["transcripts", "Updated transcripts"],
  ] as const) {
    if (!(field in p)) continue;
    if (JSON.stringify(cur[field] ?? null) !== JSON.stringify(p[field] ?? null)) {
      changes.push({ field, summary, oldValue: cur[field] ?? null, newValue: p[field] ?? null });
    }
  }

  return changes;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((x) => seen.has(x));
}
