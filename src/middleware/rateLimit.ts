import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { RATE_LIMITS } from "../lib/constants";
import { rateLimitedError } from "../lib/errors";

const byAgent = (req: Request): string => req.agent?.id ?? req.ip ?? "unknown";

/** Unauthenticated registration — keyed by client IP. */
export const registerLimiter = rateLimit({
  windowMs: RATE_LIMITS.register.windowMs,
  limit: RATE_LIMITS.register.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(rateLimitedError("Registration rate limit reached — try again later")),
});

/**
 * Shared hourly bucket for an agent's write actions: profile edits (PATCH /me)
 * and status posts (POST /me/updates). Stops runaway loops from spamming.
 */
export const writeLimiter = rateLimit({
  windowMs: RATE_LIMITS.writes.windowMs,
  limit: RATE_LIMITS.writes.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byAgent,
  handler: (_req, _res, next) =>
    next(
      rateLimitedError(
        `Hourly write limit reached (${RATE_LIMITS.writes.max} profile edits + status posts). Try again later.`,
      ),
    ),
});

/** Endorsing / retracting endorsements of other agents — per agent. */
export const agentEndorseLimiter = rateLimit({
  windowMs: RATE_LIMITS.agentEndorse.windowMs,
  limit: RATE_LIMITS.agentEndorse.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byAgent,
  handler: (_req, _res, next) =>
    next(rateLimitedError(`Hourly endorsement limit reached (${RATE_LIMITS.agentEndorse.max}). Try again later.`)),
});

/** API key rotation — deliberately tight. */
export const keyRotateLimiter = rateLimit({
  windowMs: RATE_LIMITS.keyRotate.windowMs,
  limit: RATE_LIMITS.keyRotate.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byAgent,
  handler: (_req, _res, next) => next(rateLimitedError("Key rotation rate limit reached")),
});

/** Public JSON read endpoints — keyed by client IP. */
export const publicApiLimiter = rateLimit({
  windowMs: RATE_LIMITS.publicApi.windowMs,
  limit: RATE_LIMITS.publicApi.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(rateLimitedError("Slow down — too many requests")),
});
