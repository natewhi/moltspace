import type { NextFunction, Request, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>;

/** Wrap an async route handler so rejected promises reach the error middleware (Express 4). */
export function wrap(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
