import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

function prefersJson(req: Request): boolean {
  if (req.path.startsWith("/api")) return true;
  return req.accepts(["html", "json"]) === "json";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ZodError) {
    status = 422;
    message = "Validation failed";
    details = err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
  } else if (err instanceof AppError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      message = "A record with that value already exists";
    } else if (err.code === "P2025") {
      status = 404;
      message = "Not found";
    } else {
      status = 400;
      message = "Database request error";
    }
  } else if (err instanceof SyntaxError && "body" in err) {
    status = 400;
    message = "Malformed JSON body";
  } else if (
    err != null &&
    typeof err === "object" &&
    (err as { code?: string }).code === "ERR_INVALID_CSRF_TOKEN"
  ) {
    status = 403;
    message = "Your session expired or the form was stale — reload the page and try again.";
  }

  if (status >= 500) {
    console.error("[error]", err);
  }

  if (prefersJson(req)) {
    res.status(status).json({ error: message, ...(details ? { details } : {}) });
  } else {
    res.status(status).render("error", { title: String(status), status, message });
  }
}
