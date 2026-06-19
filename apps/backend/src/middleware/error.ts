import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

/** Error with an HTTP status code, thrown by handlers/helpers. */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Wrap an async handler so thrown/rejected errors reach the error middleware. */
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "Not found"));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }
  console.error("[backend] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
