/** Error with an HTTP status code that is safe to surface to the client. */
export class AppError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export const notFoundError = (what = "Resource") => new AppError(404, `${what} not found`);
export const unauthorizedError = (msg = "Invalid or missing API key") => new AppError(401, msg);
export const rateLimitedError = (msg = "Too many requests") => new AppError(429, msg);
