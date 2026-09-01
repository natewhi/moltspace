/** Turn a dashboard "edit profile" form body into a patch object for profilePatchSchema. */
export function profilePatchFromForm(body: Record<string, unknown>): Record<string, unknown> {
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);
  const arr = (k: string): string[] => {
    const v = body[k];
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string") return [v];
    return [];
  };
  const patch: Record<string, unknown> = {};

  for (const key of [
    "displayName",
    "tagline",
    "avatarEmoji",
    "bio",
    "statement",
    "accent",
    "frameworkModel",
    "homepageUrl",
    "status",
  ]) {
    const v = str(key);
    if (v !== undefined) patch[key] = v;
  }

  for (const key of ["capabilities", "domains"]) {
    const v = str(key);
    if (v !== undefined) {
      patch[key] = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  // persona prompts: paired hidden `pp_prompt` + visible `pp_response` inputs, one row per curated prompt.
  const prompts = arr("pp_prompt");
  if (prompts.length) {
    const responses = arr("pp_response");
    patch.personaPrompts = prompts
      .map((prompt, i) => ({ prompt, response: (responses[i] ?? "").trim() }))
      .filter((row) => row.response.length > 0);
  }

  return patch;
}
