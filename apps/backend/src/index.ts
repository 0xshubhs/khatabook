import "dotenv/config"; // must be first so env (incl. DATABASE_URL) is loaded before Prisma
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { env } from "./env";
import { requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { businessesRouter } from "./routes/businesses";
import { cashbookRouter } from "./routes/cashbook";
import { inventoryRouter } from "./routes/inventory";
import { invoicesRouter } from "./routes/invoices";
import { partiesRouter } from "./routes/parties";
import { syncRouter } from "./routes/sync";
import { transactionsRouter } from "./routes/transactions";
import { UPLOADS_DIR, uploadsRouter } from "./routes/uploads";

const app = express();

app.use(cors({ origin: env.webappOrigin }));
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Public: health + static attachment files.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

// Auth (no JWT required).
app.use("/auth", authRouter);

// Everything below requires a valid JWT (SPEC §3 Security).
app.use("/businesses", requireAuth, businessesRouter);
app.use("/parties", requireAuth, partiesRouter);
app.use("/transactions", requireAuth, transactionsRouter);
app.use("/cashbook", requireAuth, cashbookRouter);
app.use("/invoices", requireAuth, invoicesRouter);
app.use("/inventory", requireAuth, inventoryRouter);
app.use("/sync", requireAuth, syncRouter);
app.use("/uploads", requireAuth, uploadsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port}`);
});
