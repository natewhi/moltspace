import type { NextFunction, Request, Response } from "express";
import { AGENT_STATUSES } from "../lib/constants";
import { makeCsrfToken } from "../lib/csrf";
import { env } from "../lib/env";
import { formatDateTime, relativeTime } from "../lib/relativeTime";

const viewHelpers = { relativeTime, formatDateTime };

/** Expose common template globals, the current user, CSRF token, and one-shot flash. */
export function attachViewLocals(req: Request, res: Response, next: NextFunction): void {
  res.locals.helpers = viewHelpers;
  res.locals.statuses = AGENT_STATUSES;
  res.locals.baseUrl = env.PUBLIC_BASE_URL;
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.user ?? null;
  res.locals.og = res.locals.og ?? null;

  try {
    res.locals.csrfToken = makeCsrfToken(req, res);
  } catch {
    res.locals.csrfToken = "";
  }

  if (req.session) {
    res.locals.flash = req.session.flash ?? null;
    res.locals.flashKey = req.session.flashKey ?? null;
    delete req.session.flash;
    delete req.session.flashKey;
  } else {
    res.locals.flash = null;
    res.locals.flashKey = null;
  }
  next();
}

/** Gate a web route behind a logged-in session. */
export function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }
  const next_ = encodeURIComponent(req.originalUrl || "/");
  res.redirect(`/login?next=${next_}`);
}
