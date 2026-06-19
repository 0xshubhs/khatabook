# Khatabook Clone

A digital ledger ("bahi khata") for small shopkeepers — track customer credit/debit,
record cash, chase payments. **Web-first:** the Next.js webapp is the product; the Expo
app is a thin WebView shell. See [`SPEC.md`](./recquirement.md) for the full build spec.

## Monorepo layout (Turborepo + pnpm)

```
apps/
  webapp/      Next.js (App Router) — THE real UI (primary)        @khatabook/webapp
  backend/     Express + TypeScript REST API                       @khatabook/backend
  rnapp/       Expo RN — thin WebView shell + native bridge         @khatabook/rnapp
packages/
  database/    Prisma schema + migrations + seed (Phase 1)         @khatabook/database
  shared/      zod schemas + types + money/balance logic           @khatabook/shared
  tsconfig/    shared base tsconfigs                               @khatabook/tsconfig
  eslint-config/  shared ESLint config (wired up later)            @khatabook/eslint-config
```

`shared` and `database` are libraries imported by the apps. The webapp depends only on
`shared` (no Prisma in the browser); the backend depends on both.

## Prerequisites

- Node >= 20 (tested on 22)
- pnpm 10 (`corepack enable` then `corepack prepare pnpm@10.18.0 --activate`)
- Docker (for Postgres, from Phase 1 on)

## Setup

```bash
pnpm install
cp .env.example .env          # adjust as needed
```

## Common scripts (run from the repo root)

```bash
pnpm dev          # turbo run dev  → starts webapp (:3000) + backend (:4000)
pnpm build        # turbo run build across all packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm db:generate  # prisma generate (no-op until Phase 1)
pnpm clean        # remove build artifacts + node_modules
```

The RN shell is run separately (it is not part of `pnpm dev`):

```bash
pnpm --filter @khatabook/rnapp start
```

## Database (Phase 1+)

```bash
docker compose up -d db        # Postgres on :5432
```

Backend and webapp Docker services are added in a later phase (see SPEC §10).

## Build status

- [x] **Phase 0** — Turborepo scaffold (workspaces, turbo pipeline, app/package skeletons)
- [x] **Phase 1** — DB (Prisma schema + migrations + seed)
- [x] **Phase 1b** — Shared money/balance logic + zod + tests (26 passing)
- [x] **Phase 2** — Backend API (auth, ledger, cashbook, reports, uploads; tenant-isolated)
- [x] **Phase 3** — Webapp core (login, home, ledger, optimistic add-entry; Tailwind + next-intl)
- [x] **Phase 4** — Reports + PDF (statement & summary) + XLSX export
- [x] **Phase 5** — Invoices (PDF, auto-total) + Inventory (stock in/out, low-stock flag)
- [x] **Phase 6** — RN shell: WebView + back button + native bridge (share/contacts/biometric) + app-lock
- [x] **Phase 7** — Offline sync (Dexie outbox + /sync push·pull, last-write-wins) + PIN app-lock + Hindi i18n
```
