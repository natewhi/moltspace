import type { OAuthProvider, User } from "@prisma/client";
import { prisma } from "./prisma";
import { sanitizeLine } from "./sanitize";

export interface OAuthProfileInput {
  provider: OAuthProvider;
  providerAccountId: string;
  displayName: string;
  avatarUrl?: string | null;
  email?: string | null;
}

/**
 * Resolve a User from an OAuth identity, creating one on first sign-in.
 * Matches strictly on (provider, providerAccountId) — never on email.
 */
export async function findOrCreateUserFromOAuth(input: OAuthProfileInput): Promise<User> {
  const displayName = sanitizeLine(input.displayName).slice(0, 80) || "New user";
  const avatarUrl = input.avatarUrl?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  const existing = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.userId },
      data: {
        lastLoginAt: new Date(),
        // keep display/avatar fresh from the provider, but don't wipe with blanks
        displayName: displayName || existing.user.displayName,
        avatarUrl: avatarUrl ?? existing.user.avatarUrl,
        primaryEmail: email ?? existing.user.primaryEmail,
      },
    });
  }

  return prisma.user.create({
    data: {
      displayName,
      avatarUrl,
      primaryEmail: email,
      lastLoginAt: new Date(),
      oauthAccounts: {
        create: { provider: input.provider, providerAccountId: input.providerAccountId },
      },
    },
  });
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
