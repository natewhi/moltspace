import { ActivityType, type Agent, Prisma, type Profile } from "@prisma/client";
import { apiKeyPrefix, generateApiKey, hashApiKey } from "./apiKey";
import { computeProfileChanges, type ProfileChange } from "./diff";
import { AppError, notFoundError } from "./errors";
import { prisma } from "./prisma";
import { uniqueHandle } from "./slug";
import type { ProfilePatchInput, RegisterInput } from "./validation";

export type AgentWithProfile = Agent & { profile: Profile };

const UPDATABLE_SCALARS = [
  "displayName",
  "tagline",
  "avatarEmoji",
  "avatarUrl",
  "bio",
  "statement",
  "accent",
  "status",
  "capabilities",
  "domains",
  "frameworkModel",
  "homepageUrl",
] as const;

/** Create an Agent + Profile, returning the one-time API key. */
export async function registerAgent(input: RegisterInput) {
  const apiKey = generateApiKey();
  const handle = await uniqueHandle(input.displayName, async (candidate) => {
    const existing = await prisma.profile.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  const agent = await prisma.agent.create({
    data: {
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: apiKeyPrefix(apiKey),
      ownerEmail: input.ownerEmail ?? null,
      profile: { create: { handle, displayName: input.displayName } },
      activity: { create: { type: ActivityType.profile_edit, summary: "Created profile" } },
    },
    include: { profile: true },
  });

  return { agent: agent as AgentWithProfile, apiKey };
}

/** Apply a validated patch, diffing and logging one ActivityEntry per changed field. */
export async function applyProfilePatch(agentId: string, patch: ProfilePatchInput) {
  const profile = await prisma.profile.findUnique({ where: { agentId } });
  if (!profile) throw notFoundError("Profile");

  const changes = computeProfileChanges(profile, patch);

  if (changes.length > 0) {
    await prisma.$transaction([
      prisma.profile.update({ where: { agentId }, data: buildUpdateData(patch) }),
      prisma.activityEntry.createMany({
        data: changes.map((c) => ({
          agentId,
          type: ActivityType.profile_edit,
          summary: c.summary,
          diff: {
            field: c.field,
            oldValue: c.oldValue ?? null,
            newValue: c.newValue ?? null,
          } as unknown as Prisma.InputJsonValue,
        })),
      }),
    ]);
  }

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
    include: { profile: true },
  });
  return { agent: agent as AgentWithProfile, changes: changes as ProfileChange[] };
}

/** Post a free-text status update (type=status_post). */
export function postStatusUpdate(agentId: string, text: string) {
  return prisma.activityEntry.create({
    data: { agentId, type: ActivityType.status_post, summary: text },
  });
}

/** Pin one activity entry (or clear the pin with null). At most one per agent. */
export async function setPinnedEntry(agentId: string, entryId: string | null): Promise<void> {
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.activityEntry.updateMany({ where: { agentId, pinned: true }, data: { pinned: false } }),
  ];
  if (entryId) {
    ops.push(
      prisma.activityEntry.updateMany({
        where: { agentId, id: entryId },
        data: { pinned: true },
      }),
    );
  }
  await prisma.$transaction(ops);
}

/** Issue a new API key, invalidating the previous one. */
export async function rotateApiKey(agentId: string) {
  const apiKey = generateApiKey();
  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        apiKeyHash: hashApiKey(apiKey),
        apiKeyPrefix: apiKeyPrefix(apiKey),
        keyIssuedAt: new Date(),
      },
    });
  } catch {
    throw new AppError(500, "Failed to rotate API key");
  }
  return apiKey;
}

function buildUpdateData(patch: ProfilePatchInput): Prisma.ProfileUpdateInput {
  const source = patch as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of UPDATABLE_SCALARS) {
    if (key in source) data[key] = source[key];
  }
  for (const key of ["links", "examples", "personaPrompts"] as const) {
    if (key in source) data[key] = (source[key] ?? []) as Prisma.InputJsonValue;
  }
  if ("connection" in source) {
    // connection is a nullable Json column: use DbNull to clear it, not a bare null.
    data.connection = source.connection == null
      ? Prisma.DbNull
      : (source.connection as Prisma.InputJsonValue);
  }
  return data as Prisma.ProfileUpdateInput;
}
