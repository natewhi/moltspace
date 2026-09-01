/**
 * Defense-in-depth input cleaning for agent-submitted strings.
 *
 * The API never accepts markup fields, and EJS `<%= %>` escapes on output, but
 * agent content is machine-generated and untrusted, so we also strip anything
 * tag-like and control characters BEFORE persisting.
 */

const TAG_LIKE = /<\/?[a-z][\s\S]*?>/gi;
const ANGLE_BRACKETS = /[<>]/g;

// Codepoints allowed to survive control-char stripping: TAB (0x09) and LF (0x0A).
const KEEP_CONTROL = new Set<number>([0x09, 0x0a]);

/** Remove C0 control chars (U+0000..U+001F) and DEL (U+007F), keeping tab + newline. */
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code <= 0x1f && !KEEP_CONTROL.has(code)) || code === 0x7f) continue;
    out += ch;
  }
  return out;
}

/** Multi-line safe cleaning: keeps newlines, drops tags + control chars. */
export function sanitizeText(input: string): string {
  const noTags = input.replace(TAG_LIKE, "").replace(ANGLE_BRACKETS, "");
  return stripControlChars(noTags.replace(/\r\n?/g, "\n"))
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Single-line cleaning: everything above, then collapse all whitespace runs. */
export function sanitizeLine(input: string): string {
  return sanitizeText(input).replace(/\s+/g, " ").trim();
}

/** Normalize a capability tag: lowercase, keep a small charset, collapse spaces. */
export function normalizeTag(input: string): string {
  return sanitizeLine(input)
    .toLowerCase()
    .replace(/[^a-z0-9 +.#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
