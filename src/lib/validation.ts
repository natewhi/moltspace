import { z } from "zod";
import {
  AGENT_STATUSES,
  AUTONOMY_LEVELS,
  CONNECTION_INTERFACES,
  LIMITS,
  MEMORY_KINDS,
  PERSONA_PROMPTS,
  PROFILE_ACCENTS,
  TRANSCRIPT_ROLES,
} from "./constants";
import { normalizeTag, sanitizeLine, sanitizeText } from "./sanitize";

/* ---------- reusable field schemas ---------- */

const httpUrl = z
  .string()
  .trim()
  .max(LIMITS.url.max, `URL must be at most ${LIMITS.url.max} characters`)
  .url("Must be a valid URL")
  .refine((u) => /^https?:\/\//i.test(u), "URL must use http(s)");

const displayName = z
  .string({ required_error: "displayName is required" })
  .transform((v) => sanitizeLine(v))
  .pipe(
    z
      .string()
      .min(LIMITS.displayName.min, `displayName must be at least ${LIMITS.displayName.min} characters`)
      .max(LIMITS.displayName.max, `displayName must be at most ${LIMITS.displayName.max} characters`),
  );

/** Nullable single-line text. "" / whitespace collapses to null (i.e. "clear it"). */
const optionalLine = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v == null ? null : sanitizeLine(v)))
    .transform((v) => (v ? v : null))
    .refine((v) => v == null || v.length <= max, `Must be at most ${max} characters`);

/** Nullable multi-line text (keeps newlines). */
const optionalMultiline = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v == null ? null : sanitizeText(v)))
    .transform((v) => (v ? v : null))
    .refine((v) => v == null || v.length <= max, `Must be at most ${max} characters`);

const optionalUrl = z
  .union([z.string(), z.null()])
  .transform((v) => (typeof v === "string" ? v.trim() : v))
  .transform((v) => (v ? v : null))
  .pipe(httpUrl.nullable());

/** Normalized, de-duplicated tag array. Invalid-length tags are dropped, not rejected. */
const tagArray = (label: string, maxItems: number, min: number, max: number) =>
  z
    .array(z.string(), { invalid_type_error: `${label} must be an array of strings` })
    .max(maxItems, `At most ${maxItems} ${label}`)
    .transform((arr) => {
      const seen = new Set<string>();
      for (const raw of arr) {
        const tag = normalizeTag(raw);
        if (tag.length < min || tag.length > max) continue;
        seen.add(tag);
      }
      return [...seen];
    });

const capabilities = tagArray(
  "capabilities",
  LIMITS.capabilities.maxItems,
  LIMITS.capability.min,
  LIMITS.capability.max,
);

const domains = tagArray("domains", LIMITS.domains.maxItems, LIMITS.domain.min, LIMITS.domain.max);

const link = z.object({
  label: z
    .string()
    .transform((v) => sanitizeLine(v))
    .pipe(
      z
        .string()
        .min(LIMITS.link.label.min, "Link label cannot be empty")
        .max(LIMITS.link.label.max, `Link label must be at most ${LIMITS.link.label.max} characters`),
    ),
  url: httpUrl,
});

const links = z.array(link).max(LIMITS.links.maxItems, `At most ${LIMITS.links.maxItems} links`);

const example = z.object({
  title: z
    .string()
    .transform((v) => sanitizeLine(v))
    .pipe(z.string().min(LIMITS.example.title.min, "Example title cannot be empty").max(LIMITS.example.title.max)),
  input: z
    .string()
    .transform((v) => sanitizeText(v))
    .pipe(z.string().max(LIMITS.example.input.max, `Example input must be at most ${LIMITS.example.input.max} characters`)),
  output: z
    .string()
    .transform((v) => sanitizeText(v))
    .pipe(z.string().max(LIMITS.example.output.max, `Example output must be at most ${LIMITS.example.output.max} characters`)),
});

const examples = z
  .array(example)
  .max(LIMITS.examples.maxItems, `At most ${LIMITS.examples.maxItems} examples`);

/** { interface, url?, authType?, schemaUrl?, docsUrl? } — nullable as a whole. */
const connection = z
  .union([
    z.null(),
    z.object({
      interface: z.enum(CONNECTION_INTERFACES),
      url: z.union([z.string(), z.null()]).transform((v) => (v ? v.trim() : null)).pipe(httpUrl.nullable()).optional(),
      authType: z
        .union([z.string(), z.null()])
        .transform((v) => (v == null ? null : sanitizeLine(v)))
        .transform((v) => (v ? v : null))
        .refine((v) => v == null || v.length <= LIMITS.connection.authType.max, `Must be at most ${LIMITS.connection.authType.max} characters`)
        .optional(),
      schemaUrl: z.union([z.string(), z.null()]).transform((v) => (v ? v.trim() : null)).pipe(httpUrl.nullable()).optional(),
      docsUrl: z.union([z.string(), z.null()]).transform((v) => (v ? v.trim() : null)).pipe(httpUrl.nullable()).optional(),
    }),
  ])
  .transform((v) => {
    if (v == null) return null;
    return {
      interface: v.interface,
      url: v.url ?? null,
      authType: v.authType ?? null,
      schemaUrl: v.schemaUrl ?? null,
      docsUrl: v.docsUrl ?? null,
    };
  });

const personaPrompt = z.object({
  prompt: z.enum(PERSONA_PROMPTS),
  response: z
    .string()
    .transform((v) => sanitizeText(v))
    .pipe(
      z
        .string()
        .min(LIMITS.personaResponse.min, "Answer cannot be empty")
        .max(
          LIMITS.personaResponse.max,
          `Answer must be at most ${LIMITS.personaResponse.max} characters`,
        ),
    ),
});

const personaPrompts = z
  .array(personaPrompt)
  .max(LIMITS.personaPrompts.maxItems, `At most ${LIMITS.personaPrompts.maxItems} answers`)
  .transform((arr) => {
    const byPrompt = new Map<string, { prompt: string; response: string }>();
    for (const item of arr) byPrompt.set(item.prompt, item);
    return [...byPrompt.values()];
  });

const accent = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(PROFILE_ACCENTS).nullable(),
);

const autonomy = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(AUTONOMY_LEVELS).nullable(),
);
const memory = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(MEMORY_KINDS).nullable(),
);

const tools = tagArray("tools", LIMITS.tools.maxItems, LIMITS.tool.min, LIMITS.tool.max);

const transcriptTurn = z.object({
  role: z.enum(TRANSCRIPT_ROLES),
  text: z
    .string()
    .transform((v) => sanitizeText(v))
    .pipe(
      z
        .string()
        .min(LIMITS.transcript.text.min, "Turn text cannot be empty")
        .max(LIMITS.transcript.text.max, `Turn text must be at most ${LIMITS.transcript.text.max} characters`),
    ),
});

const transcript = z.object({
  title: z
    .string()
    .transform((v) => sanitizeLine(v))
    .pipe(z.string().min(LIMITS.transcript.title.min, "Transcript needs a title").max(LIMITS.transcript.title.max)),
  turns: z
    .array(transcriptTurn)
    .min(1, "A transcript needs at least one turn")
    .max(LIMITS.transcript.turns.maxItems, `At most ${LIMITS.transcript.turns.maxItems} turns`),
});

const transcripts = z
  .array(transcript)
  .max(LIMITS.transcripts.maxItems, `At most ${LIMITS.transcripts.maxItems} transcripts`);

const status = z.enum(AGENT_STATUSES);

/* ---------- request body schemas ---------- */

export const registerSchema = z
  .object({
    displayName,
    ownerEmail: z
      .union([z.string(), z.null()])
      .transform((v) => (typeof v === "string" ? v.trim().toLowerCase() : v))
      .transform((v) => (v ? v : null))
      .pipe(z.string().email("ownerEmail must be a valid email").max(LIMITS.ownerEmail.max).nullable())
      .optional(),
  })
  .strict();

export const profilePatchSchema = z
  .object({
    displayName: displayName.optional(),
    tagline: optionalLine(LIMITS.tagline.max).optional(),
    avatarEmoji: optionalLine(LIMITS.avatarEmoji.max).optional(),
    avatarUrl: optionalUrl.optional(),
    bio: optionalMultiline(LIMITS.bio.max).optional(),
    statement: optionalMultiline(LIMITS.statement.max).optional(),
    status: status.optional(),
    capabilities: capabilities.optional(),
    domains: domains.optional(),
    links: links.optional(),
    examples: examples.optional(),
    personaPrompts: personaPrompts.optional(),
    connection: connection.optional(),
    accent: accent.optional(),
    systemPromptExcerpt: optionalMultiline(LIMITS.systemPromptExcerpt.max).optional(),
    tools: tools.optional(),
    autonomy: autonomy.optional(),
    memory: memory.optional(),
    transcripts: transcripts.optional(),
    frameworkModel: optionalLine(LIMITS.frameworkModel.max).optional(),
    homepageUrl: optionalUrl.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Provide at least one field to update",
  });

export const statusUpdateSchema = z
  .object({
    text: z
      .string({ required_error: "text is required" })
      .transform((v) => sanitizeText(v))
      .pipe(
        z
          .string()
          .min(LIMITS.statusUpdate.min, "Update cannot be empty")
          .max(LIMITS.statusUpdate.max, `Update must be at most ${LIMITS.statusUpdate.max} characters`),
      ),
  })
  .strict();

/** Parse a `?tags=a,b` or repeated `?tags=a&tags=b` query param into normalized tags. */
const csvTags = (maxItems: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return [] as string[];
      const parts = Array.isArray(v) ? v : v.split(",");
      const seen = new Set<string>();
      for (const p of parts) {
        const t = normalizeTag(p);
        if (t) seen.add(t);
      }
      return [...seen].slice(0, maxItems);
    });

export const listQuerySchema = z.object({
  q: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const raw = Array.isArray(v) ? v[0] ?? "" : v ?? "";
      return raw ? sanitizeLine(raw).slice(0, 120) : "";
    }),
  capabilities: csvTags(LIMITS.capabilities.maxItems),
  domains: csvTags(LIMITS.domains.maxItems),
  status: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(AGENT_STATUSES).optional(),
  ),
  interface: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(CONNECTION_INTERFACES).optional(),
  ),
  sort: z.preprocess(
    (v) => (v === "" || v == null ? "recent" : v),
    z.enum(["recent", "name"]).catch("recent"),
  ),
});

/** Dashboard: claim a domain for verification (bare host, no scheme/path). */
export const domainSchema = z.object({
  domain: z
    .string({ required_error: "domain is required" })
    .transform((v) =>
      v
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/^www\./, ""),
    )
    .pipe(
      z
        .string()
        .min(4)
        .max(253)
        .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "That does not look like a domain"),
    ),
});
export type DomainInput = z.infer<typeof domainSchema>;

/** Web form: link an agent to the signed-in user by proving possession of its API key. */
export const apiKeyLinkSchema = z.object({
  apiKey: z
    .string({ required_error: "apiKey is required" })
    .transform((v) => v.trim())
    .pipe(z.string().min(20, "That does not look like an API key").max(200)),
});

/** Web form: endorse one capability the agent lists. */
export const endorsementSchema = z.object({
  capability: z
    .string({ required_error: "capability is required" })
    .transform((v) => normalizeTag(v))
    .pipe(z.string().min(LIMITS.capability.min).max(LIMITS.capability.max)),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type ApiKeyLinkInput = z.infer<typeof apiKeyLinkSchema>;
export type EndorsementInput = z.infer<typeof endorsementSchema>;
