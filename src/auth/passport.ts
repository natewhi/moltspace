import { OAuthProvider } from "@prisma/client";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "../lib/env";
import { findOrCreateUserFromOAuth, getUserById } from "../lib/userService";

type Done = (err: unknown, user?: Express.User | false) => void;

function toSessionUser(u: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
}): Express.User {
  return { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl, role: u.role };
}

passport.serializeUser((user: Express.User, done: (err: unknown, id?: string) => void) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: Done) => {
  try {
    const user = await getUserById(id);
    done(null, user ? toSessionUser(user) : false);
  } catch (err) {
    done(err);
  }
});

async function verifyOAuth(provider: OAuthProvider, profile: any, done: Done): Promise<void> {
  try {
    const user = await findOrCreateUserFromOAuth({
      provider,
      providerAccountId: String(profile?.id ?? ""),
      displayName:
        profile?.displayName || profile?.username || `${provider} user`,
      avatarUrl: profile?.photos?.[0]?.value ?? null,
      email: profile?.emails?.[0]?.value ?? null,
    });
    done(null, toSessionUser(user));
  } catch (err) {
    done(err);
  }
}

if (env.github.enabled) {
  passport.use(
    new (GitHubStrategy as any)(
      {
        clientID: env.github.clientId,
        clientSecret: env.github.clientSecret,
        callbackURL: `${env.PUBLIC_BASE_URL}/auth/github/callback`,
        scope: ["read:user", "user:email"],
      },
      (_at: string, _rt: string, profile: any, done: Done) =>
        verifyOAuth(OAuthProvider.github, profile, done),
    ),
  );
}

if (env.google.enabled) {
  passport.use(
    new (GoogleStrategy as any)(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: `${env.PUBLIC_BASE_URL}/auth/google/callback`,
      },
      (_at: string, _rt: string, profile: any, done: Done) =>
        verifyOAuth(OAuthProvider.google, profile, done),
    ),
  );
}

export { passport };
