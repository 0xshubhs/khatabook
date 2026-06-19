import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "./error";

/** Require a valid access JWT; sets req.userId. All non-auth routes use this. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new ApiError(401, "Missing or malformed Authorization header"));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
};
