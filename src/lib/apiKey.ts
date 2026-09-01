import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "agk_";

/** Generate a fresh API key: `agk_` + 32 bytes of CSPRNG output, base64url-encoded. */
export function generateApiKey(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

/**
 * Hash a key for storage / lookup. The key is full-entropy random, so a fast
 * cryptographic hash is appropriate here (a slow password hash buys nothing and
 * would tax every authenticated request).
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** Non-secret prefix kept on the Agent row for support/debugging (e.g. "agk_7f3a1b"). */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, PREFIX.length + 6);
}

/** Constant-time compare of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function parseBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1]!.trim() : null;
}
