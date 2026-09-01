import type { NextFunction, Request, Response } from "express";
import { hashApiKey, parseBearer } from "../lib/apiKey";
import { unauthorizedError } from "../lib/errors";
import { prisma } from "../lib/prisma";

/**
 * Authenticates an agent from `Authorization: Bearer <key>`. The raw key is
 * hashed and looked up; it is never logged.
 */
export async function requireApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const key = parseBearer(req.get("authorization"));
    if (!key) {
      next(unauthorizedError("Missing bearer token"));
      return;
    }

    const agent = await prisma.agent.findUnique({
      where: { apiKeyHash: hashApiKey(key) },
      include: { profile: true },
    });

    if (!agent || !agent.profile) {
      next(unauthorizedError());
      return;
    }

    req.agent = agent as typeof agent & { profile: NonNullable<typeof agent.profile> };
    req.profile = agent.profile;
    next();
  } catch (err) {
    next(err);
  }
}
