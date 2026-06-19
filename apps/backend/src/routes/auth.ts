import { prisma } from "@khatabook/database";
import {
  requestOtpSchema,
  setPinSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "@khatabook/shared";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { env } from "../env";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";

export const authRouter = Router();

function publicUser(u: {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  pinHash: string | null;
}) {
  return { id: u.id, phone: u.phone, name: u.name, email: u.email, hasPin: u.pinHash != null };
}

// POST /auth/request-otp — dev mode: any phone works, OTP is env.devOtp.
authRouter.post(
  "/request-otp",
  asyncHandler(async (req, res) => {
    const { phone } = requestOtpSchema.parse(req.body);
    console.log(`[auth] OTP for ${phone} is ${env.devOtp} (dev mode)`);
    res.json({ ok: true });
  }),
);

// POST /auth/verify-otp -> { accessToken, refreshToken, user }
authRouter.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const { phone, otp } = verifyOtpSchema.parse(req.body);
    if (otp !== env.devOtp) throw new ApiError(401, "Invalid OTP");

    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    // Every user needs at least one business to use the app — create a default
    // one on first login so the account is immediately usable.
    const businessCount = await prisma.business.count({
      where: { userId: user.id, deletedAt: null },
    });
    if (businessCount === 0) {
      await prisma.business.create({ data: { userId: user.id, name: "My Business" } });
    }

    res.json({
      accessToken: signAccessToken(user.id),
      refreshToken: signRefreshToken(user.id),
      user: publicUser(user),
    });
  }),
);

// POST /auth/refresh { refreshToken } -> new tokens
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = (req.body as { refreshToken?: unknown }).refreshToken;
    if (typeof token !== "string") throw new ApiError(400, "refreshToken required");
    let userId: string;
    try {
      userId = verifyRefreshToken(token).sub;
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }
    res.json({
      accessToken: signAccessToken(userId),
      refreshToken: signRefreshToken(userId),
    });
  }),
);

// GET /auth/me -> current user profile
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new ApiError(404, "User not found");
    res.json(publicUser(user));
  }),
);

// PATCH /auth/profile { name?, email? }
authRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email === "" ? null : data.email } : {}),
      },
    });
    res.json(publicUser(user));
  }),
);

// POST /auth/set-pin { pin } (requires auth)
authRouter.post(
  "/set-pin",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pin } = setPinSchema.parse(req.body);
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.user.update({ where: { id: req.userId! }, data: { pinHash } });
    res.json({ ok: true });
  }),
);
