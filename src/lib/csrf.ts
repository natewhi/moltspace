import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";
import { env } from "./env";

const csrfSecret = env.SESSION_SECRET || "insecure-dev-secret-change-me";

const { doubleCsrfProtection, generateToken, invalidCsrfTokenError } = doubleCsrf({
  getSecret: () => csrfSecret,
  cookieName: env.COOKIE_SECURE ? "__Host-agentdir.x-csrf" : "agentdir.x-csrf",
  // csrf-csrf always sets the cookie httpOnly; sameSite/secure/path are configurable.
  cookieOptions: {
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
  },
  size: 64,
  getTokenFromRequest: (req: Request) => {
    const body = req.body as Record<string, unknown> | undefined;
    return (body?._csrf as string | undefined) ?? (req.headers["x-csrf-token"] as string | undefined);
  },
});

export { doubleCsrfProtection as csrfProtection, generateToken as makeCsrfToken, invalidCsrfTokenError };
