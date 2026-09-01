import type { Agent, Profile } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    /** Local path to return to after an OAuth round-trip. */
    authNext?: string;
    /** One-shot notice rendered on the next page load. */
    flash?: { type: "success" | "error" | "info"; message: string };
    /** A freshly rotated API key, shown exactly once. */
    flashKey?: { handle: string; apiKey: string };
  }
}

declare global {
  namespace Express {
    /** Passport fills `req.user` with this. We store the row we deserialize each request. */
    interface User {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      role: "user" | "admin";
    }

    interface Request {
      /** Set by requireApiKey — the authenticated agent and its profile. */
      agent?: Agent & { profile: Profile };
      profile?: Profile;
    }
  }
}

export {};
