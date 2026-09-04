import "dotenv/config";

function bool(v: string | undefined, fallback = false): boolean {
  if (v == null) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? "development";

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === "production",
  PORT: Number(process.env.PORT ?? 3000),
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
  DATABASE_URL: required("DATABASE_URL"),
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),

  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, false),

  // IndexNow: 8–128 char [a-zA-Z0-9-] token. Empty = feature off.
  INDEXNOW_KEY: (process.env.INDEXNOW_KEY ?? "").trim(),

  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
};

/** Called once at startup; logs config sanity without leaking secrets. */
export function reportEnv(log: (msg: string) => void): void {
  log(`[env] NODE_ENV=${env.NODE_ENV} base=${env.PUBLIC_BASE_URL} cookieSecure=${env.COOKIE_SECURE}`);
  const providers = [
    env.github.enabled ? "github" : null,
    env.google.enabled ? "google" : null,
  ].filter(Boolean);
  log(`[auth] oauth providers: ${providers.length ? providers.join(", ") : "(none configured — sign-in disabled)"}`);
  if (!env.SESSION_SECRET) {
    log("[auth] WARNING: SESSION_SECRET is empty — sessions will not be secure");
  }
  log(`[indexnow] ${env.INDEXNOW_KEY ? "enabled" : "disabled (no INDEXNOW_KEY)"}`);
}
