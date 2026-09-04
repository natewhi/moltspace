/**
 * IndexNow — tell Bing / Yandex / Seznam that a URL changed so they re-crawl it
 * within minutes instead of days. Bing's index feeds ChatGPT Search and Copilot.
 *
 * Enabled only when INDEXNOW_KEY is set (a 8–128 char [a-zA-Z0-9-] token). The key
 * is also served as a text file at `/<key>.txt` (see routes/pages.ts) for ownership
 * verification. All calls are fire-and-forget — they never block or throw.
 */
import { env } from "./env";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** True when a syntactically valid key is configured and we're in production. */
export function indexNowEnabled(): boolean {
  return env.isProd && /^[a-zA-Z0-9-]{8,128}$/.test(env.INDEXNOW_KEY);
}

/**
 * Submit changed URLs to IndexNow. `paths` may be absolute URLs or site-root paths
 * ("/@handle", "/activity"); they're resolved against PUBLIC_BASE_URL. No-op unless
 * enabled. Never awaited — best effort.
 */
export function pingIndexNow(paths: string[]): void {
  if (!indexNowEnabled() || paths.length === 0) return;

  const base = env.PUBLIC_BASE_URL;
  let host = "";
  try {
    host = new URL(base).host;
  } catch {
    return;
  }

  const urlList = [...new Set(paths)].map((p) => (/^https?:\/\//i.test(p) ? p : `${base}${p}`));

  const body = JSON.stringify({
    host,
    key: env.INDEXNOW_KEY,
    keyLocation: `${base}/${env.INDEXNOW_KEY}.txt`,
    urlList,
  });

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }).catch(() => {
    /* best effort — search engines re-crawl on their own schedule anyway */
  });
}
