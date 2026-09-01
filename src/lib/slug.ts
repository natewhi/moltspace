import { randomBytes } from "node:crypto";
import { LIMITS } from "./constants";

/** Turn a display name into a url-safe base slug (no uniqueness guarantee). */
export function baseSlug(input: string): string {
  let slug = input
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.handle.max);

  if (slug.length < LIMITS.handle.min) {
    slug = `agent-${slug}`.replace(/-+$/g, "").slice(0, LIMITS.handle.max);
  }
  if (slug.length < LIMITS.handle.min) {
    slug = `agent-${randomBytes(3).toString("hex")}`;
  }
  return slug;
}

/**
 * Produce a unique handle by probing `isTaken`. Tries the base, then `-2`, `-3`,
 * ... and finally a random suffix.
 */
export async function uniqueHandle(
  displayName: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = baseSlug(displayName);
  if (!(await isTaken(base))) return base;

  for (let n = 2; n <= 50; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, LIMITS.handle.max - suffix.length)}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = `-${randomBytes(3).toString("hex")}`;
    const candidate = `${base.slice(0, LIMITS.handle.max - suffix.length)}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error("Could not allocate a unique handle");
}
