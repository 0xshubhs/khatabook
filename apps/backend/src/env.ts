// Environment config. `dotenv/config` is imported first in index.ts so these
// are populated before anything (incl. the Prisma client) reads them.
const PORT = Number(process.env.PORT ?? 4000);

export const env = {
  port: PORT,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  accessTokenTtl: "15m",
  refreshTokenTtl: "30d",
  // Comma-separated list so the webapp works from both localhost (Mac browser)
  // and the Mac's LAN IP (phone WebView over Wi-Fi).
  webappOrigin: (process.env.WEBAPP_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim()),
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${PORT}`,
  // Dev OTP: any phone + this code logs in (SPEC §3).
  devOtp: process.env.DEV_OTP ?? "123456",
} as const;
