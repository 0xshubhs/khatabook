# Khatabook Clone — Full Build Spec

This document is the source of truth for building a faithful Khatabook clone.
Claude Code: read this whole file, then build in the order under **Build Plan**.
Pause after each phase, verify the listed checks pass, then continue.

---

## 0. Priority & architecture principle (read first)

**The webapp is the product. The mobile app is a thin shell.**

- `apps/webapp` (Next.js) contains **all** screens, state, offline store, i18n, and
  product logic. It is mobile-first and renders correctly at ~390px on its own.
- `apps/rnapp` (Expo) is a **thin WebView wrapper**. It contains only: a full-screen
  WebView pointing at the webapp, the Android back-button handling, the app-lock gate,
  and a `postMessage` native bridge (share / contacts / biometric / push). It contains
  **no product screens and no business logic.**
- Therefore the build order, effort, and polish are **web-first**. When web and native
  work conflict for time, the webapp wins. The webapp must be fully usable in a plain
  mobile browser before the RN shell is touched.

Corollary: anything used by **both** the webapp and the backend (money math, balance
rules, zod schemas, shared types) lives in `packages/shared` and is imported by both —
never copy-pasted. The webapp computes balances locally for offline/optimistic UI; the
backend computes them authoritatively. They **must** use the same functions or they will
drift. This single rule is the main reason this repo is a Turborepo.

---

## 1. What we're building

A digital ledger ("bahi khata") app for small shopkeepers to track customer
credit/debit (*udhaar*), record cash expenses, and chase payments. The product's
entire value is **speed + simplicity + offline reliability**. A shopkeeper must be
able to log a transaction in 2–3 taps while a customer is standing in front of them.

Two separate "books":
1. **Ledger (Khata)** — one page per customer/supplier. Tracks who owes whom.
2. **Cashbook** — daily cash-in / cash-out for the business itself (expenses/income).

Do NOT build formal double-entry accounting. Khatabook uses a single-entry model
on purpose. Keep it simple.

---

## 2. Tech stack & repo layout (Turborepo)

**Monorepo: Turborepo + pnpm workspaces.** Deployable apps live in `apps/`; shared
libraries the apps import live in `packages/`.

```
khatabook-clone/
├─ apps/
│  ├─ webapp/            Next.js (App Router) + TS + Tailwind — THE real UI (primary)
│  ├─ backend/           Express + TypeScript REST API
│  └─ rnapp/             Expo React Native — thin WebView shell + native bridge only
├─ packages/
│  ├─ database/          Prisma schema + migrations + generated client + seed
│  ├─ shared/            zod schemas, TS types, money + balance logic, constants
│  ├─ tsconfig/          shared base tsconfigs (base / next / node / react-native)
│  └─ eslint-config/     shared ESLint + Prettier config
├─ turbo.json            task pipeline (build/dev/lint/test/db:*)
├─ pnpm-workspace.yaml   packages: ["apps/*", "packages/*"]
├─ package.json          root: workspace scripts that delegate to turbo
├─ docker-compose.yml    Postgres + backend + webapp, one command
├─ .env.example
├─ SPEC.md               (this file)
└─ README.md
```

**Internal package names** (referenced via `workspace:*`):
- `@khatabook/database` — exports the Prisma client + types. Owns `prisma generate`,
  migrations, and seed. Any app touching the DB depends on this package.
- `@khatabook/shared` — pure TypeScript: zod schemas, shared TS types, money helpers
  (`formatPaise`, `parseRupeesToPaise`) and balance logic (`computePartyBalance`,
  `computeRunningBalance`, `computeBusinessTotals`, `computeCashbookNet`). Imported by
  both `backend` and `webapp`. No I/O, fully unit-testable.
- `@khatabook/tsconfig`, `@khatabook/eslint-config` — shared config presets.

**`turbo.json` essentials (Turborepo 2.x `tasks`):**
- `db:generate` → runs `prisma generate` (no cache); `build`/`dev` depend on it.
- `build` → `dependsOn: ["^build", "db:generate"]`, declares `outputs` for caching.
- `dev` → `cache: false`, `persistent: true`.
- `lint`, `test` → standard cached tasks.
- Root scripts: `pnpm dev` → `turbo run dev`, `pnpm build` → `turbo run build`, etc.
  The package graph guarantees `database`/`shared` build before `backend`/`webapp`.

Rules that apply everywhere:
- TypeScript everywhere. Strict mode on. One shared base `tsconfig` per target.
- **Money is stored and computed as INTEGER paise.** Never use floats for money.
  Format to ₹ only at the display layer (divide by 100). The conversion + balance
  helpers live in `@khatabook/shared` and are the *only* place math happens.
  (`Int` paise caps at ~₹21.4M per entry — fine for a shopkeeper; Postgres `SUM`
  promotes to `bigint`, so aggregate totals don't overflow.)
- All dates stored UTC; display in the user's locale.
- Auth via JWT (access + refresh). Phone + OTP login.
- Validate every API input with zod — using the **same** schemas from `@khatabook/shared`
  that the webapp uses for client-side validation.

---

## 3. Full feature list (replicate Khatabook)

Build ALL of these. Phases tell you the order.

**Auth & account**
- Phone-number login with OTP (dev mode: any number + OTP `123456` works).
- Optional app lock: 4-digit PIN / biometric (biometric handled in RN shell).

**Businesses**
- One account can own multiple businesses; user switches between them.
- Each business has its own ledger, cashbook, inventory, invoices.

**Ledger (Khata)**
- A "party" = a customer or supplier = one ledger page.
- Add party manually or from phone contacts (contact picker via RN bridge).
- Per party: **YOU GAVE** (credit, increases what they owe you, shown RED) and
  **YOU GOT** (debit, payment received, shown GREEN).
- Each entry: amount (required), note, photo attachment, date, optional due date.
- Running balance per party, auto-calculated, shown at top of the page.
- Home screen totals: **total receivable** (sum you'll collect) and
  **total payable** (sum you owe suppliers).
- Color coding everywhere: red = they owe you / payable due, green = settled/credit.

**Cashbook**
- Cash IN / cash OUT entries with a category (e.g. Rent, Salary, Sales, Misc).
- Daily / date-range net balance.
- Same attachment + note support as ledger.

**Reminders & sharing**
- "Remind" button on a party with a balance → sends a payment reminder.
  Provide an SMS provider interface + a WhatsApp deep-link option.
  In dev, stub it: log the message and write a `Reminder` row.
- Share a party statement or single entry as a link / PDF.

**Reports**
- Business summary: total receivable, total payable, cashbook net, over a date range.
- Party statement: full transaction history + running balance.
- Sales & purchase report.
- Export: **PDF** (statement) and **Excel/XLSX** (summary). One-tap download + share.

**Invoicing**
- Create an invoice for a party: line items (name, qty, rate), auto total, invoice number.
- Generate invoice PDF, share it.

**Inventory**
- Items: name, current stock qty, low-stock threshold, price.
- Stock in/out adjusts qty. Low-stock alert flag when qty <= threshold.

**Sync & backup**
- Local-first on mobile (see §6). Server is the backup + multi-device sync source.
- User can log in on a new device and restore everything.

**i18n**
- Build the webapp with an i18n layer (e.g. next-intl) **scaffolded from Phase 3**.
  Ship English + Hindi; structure so more languages drop in via JSON files.
  Wrap strings as screens are built — do not retrofit i18n at the end.

**Security**
- App-lock (PIN/biometric) gates the app open in the RN shell.
- All API routes except auth require a valid JWT.
- **Tenant isolation:** every handler that takes a `partyId` / `:id` must verify the
  resource belongs to a business owned by the JWT's user. Never trust the client's
  scope. This is the easiest security bug to ship — call it out in every route.

---

## 4. Data model (Prisma / Postgres) — offline-sync ready

Two non-negotiables baked in from Phase 1 (retrofitting these later is a painful
migration across every table):

1. **Client-generated IDs.** Each record's `id` is a **client-generated UUID v4** so
   the record exists offline before the server ever sees it. The server accepts the
   client's `id` as the primary key on upsert. `@default(uuid())` is only a fallback
   for rows created directly on the server (e.g. seed).
2. **Sync columns on every syncable model:** `updatedAt` (`@updatedAt`) and
   `deletedAt DateTime?` (soft delete — never hard-delete syncable rows; sync needs the
   tombstone). `syncStatus` is **client-only** (lives in the Dexie local store, §6) and
   is **not** a Postgres column.

```prisma
model User {
  id         String   @id @default(uuid())
  phone      String   @unique
  name       String?
  pinHash    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  businesses Business[]
}

model Business {
  id        String    @id @default(uuid())   // client-generated UUID on create
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  parties   Party[]
  cashbook  CashbookEntry[]
  invoices  Invoice[]
  inventory InventoryItem[]
  reminders Reminder[]
}

model Party {
  id           String        @id @default(uuid())
  businessId   String
  business     Business      @relation(fields: [businessId], references: [id])
  name         String
  phone        String?
  type         PartyType     @default(CUSTOMER)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?
  transactions Transaction[]
  reminders    Reminder[]
}

enum PartyType { CUSTOMER SUPPLIER }

model Transaction {
  id            String          @id @default(uuid())
  partyId       String
  party         Party           @relation(fields: [partyId], references: [id])
  type          TransactionType // CREDIT = "you gave", DEBIT = "you got"
  amountPaise   Int
  note          String?
  attachmentUrl String?
  txnDate       DateTime        @default(now())
  dueDate       DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  deletedAt     DateTime?
}

enum TransactionType { CREDIT DEBIT }

model CashbookEntry {
  id            String        @id @default(uuid())
  businessId    String
  business      Business      @relation(fields: [businessId], references: [id])
  direction     CashDirection // IN / OUT
  amountPaise   Int
  category      String?
  note          String?
  attachmentUrl String?
  entryDate     DateTime      @default(now())
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?
}

enum CashDirection { IN OUT }

model Invoice {
  id          String    @id @default(uuid())
  businessId  String
  business    Business  @relation(fields: [businessId], references: [id])
  partyId     String?
  number      String
  items       Json      // [{ name, qty, ratePaise }]
  totalPaise  Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
}

model InventoryItem {
  id                String    @id @default(uuid())
  businessId        String
  business          Business  @relation(fields: [businessId], references: [id])
  name              String
  stockQty          Int       @default(0)
  lowStockThreshold Int       @default(0)
  pricePaise        Int       @default(0)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
}

model Reminder {
  id         String   @id @default(uuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id])
  partyId    String
  party      Party    @relation(fields: [partyId], references: [id])
  channel    String   // "SMS" | "WHATSAPP" | "STUB"
  message    String
  sentAt     DateTime @default(now())
}
```

Seed (in `packages/database`): 1 demo user (`+919999999999`), 1 business, 5 parties,
~20 transactions across them, ~10 cashbook entries, 3 inventory items. So login →
populated screen immediately.

---

## 5. Core business logic (get this exactly right)

**This logic lives in `packages/shared` as pure functions and is imported by both the
backend and the webapp. Unit-test it there.** It is the single source of truth — the
webapp uses it for instant/offline computation, the backend for authoritative values.

**Party balance** = `SUM(CREDIT amounts) - SUM(DEBIT amounts)` for that party.
- Positive balance → party owes the shopkeeper money (receivable, show RED).
- Negative balance → shopkeeper owes the party (payable, show GREEN / "Advance").
- Display as `abs(balance)` with a label: "₹X due" (red) or "₹X advance" (green).

**Business receivable** = sum of all positive party balances.
**Business payable** = sum of all negative party balances (absolute).

**Cashbook net** = `SUM(IN) - SUM(OUT)` over the selected range.

**Running balance on the ledger page**: walk transactions oldest→newest, keep a
running total using the same credit-positive / debit-negative rule; show the balance
after each entry next to it.

Compute balances in integer paise; only divide by 100 at render. Soft-deleted rows
(`deletedAt != null`) are excluded from every balance computation.

---

## 6. Offline-first & sync (this is what makes it truly "like Khatabook")

The mobile UX must work with no internet, because the target users often have poor
connectivity. Implement it in the **webapp** (since the RN shell loads the webapp):

- Local store: IndexedDB (use Dexie.js) holds parties, transactions, cashbook, etc.
  The Dexie record shape = the server shape **plus** a client-only `syncStatus`
  (`"pending" | "synced" | "error"`) field.
- All reads render from local store first (instant). Balances are computed locally with
  `@khatabook/shared` so there is no wait. All writes go to local store immediately
  (optimistic UI) with a **client-generated UUID** and enqueue a sync job.
- A sync worker flushes the queue to the backend when online; on reconnect it pushes
  pending local changes (`/sync/push`) and pulls server changes (`/sync/pull?since=`).
- Conflict rule: last-write-wins by `updatedAt`. Soft delete via `deletedAt`; tombstones
  sync like any other change so deletes propagate across devices.
- Because IDs are client-generated, a record created offline keeps the same identity
  once it reaches the server — no ID remapping needed.

If full offline sync is too large for the first pass, build the app **online-first but
local-cached** in Phase 3, and add the sync queue as Phase 7. Do not skip it entirely —
it's core to the product. (The schema already carries `updatedAt`/`deletedAt` and uses
client UUIDs, so Phase 7 is additive, not a migration.)

---

## 7. Backend API (Express)

JSON REST. All money fields are `*Paise` integers. All non-auth routes require JWT.
Every resource route enforces tenant isolation (§3 Security).

```
POST   /auth/request-otp        { phone }
POST   /auth/verify-otp         { phone, otp } -> { accessToken, refreshToken, user }
POST   /auth/refresh
POST   /auth/set-pin            { pin }

GET    /businesses
POST   /businesses
PATCH  /businesses/:id
DELETE /businesses/:id

GET    /businesses/:id/parties
POST   /businesses/:id/parties
PATCH  /parties/:id
DELETE /parties/:id
GET    /parties/:id/ledger       -> entries + running balance + party balance
POST   /parties/:id/remind       -> stub reminder (log + write Reminder row)

POST   /transactions             { id?, partyId, type, amountPaise, note?, attachmentUrl?, txnDate?, dueDate? }
PATCH  /transactions/:id
DELETE /transactions/:id

GET    /businesses/:id/cashbook   ?from&to
POST   /cashbook
PATCH  /cashbook/:id
DELETE /cashbook/:id

GET    /businesses/:id/inventory
POST   /inventory
PATCH  /inventory/:id              (also used for stock in/out)
DELETE /inventory/:id

GET    /businesses/:id/invoices
POST   /invoices
GET    /invoices/:id/pdf

GET    /businesses/:id/reports/summary  ?from&to  -> { receivable, payable, cashbookNet, sales, purchases }
GET    /parties/:id/statement.pdf
GET    /businesses/:id/reports/summary.xlsx

POST   /uploads                    (image attachment -> returns attachmentUrl; local disk or S3)

GET    /sync/pull                  ?since=<timestamp>   (for offline sync)
POST   /sync/push                  { changes: [...] }   (batch upsert from client; ids are client UUIDs)

GET    /health -> 200
```

Include: zod validation (schemas imported from `@khatabook/shared`), central error
middleware, request logging, CORS for the webapp origin. `POST` create routes accept an
optional client-provided `id` (UUID) so offline-created records keep their identity.

---

## 8. Webapp screens (Next.js) — mobile-first, WebView-friendly

Design for a ~390px-wide phone viewport. Large tap targets, bottom-anchored primary
actions, number keypad opens immediately on amount fields. One accent color, clean.
Keep design tokens in Tailwind config; crisp, not cluttered.

1. **Login** — phone input → OTP input. Minimal.
2. **App lock** — PIN entry screen (skipped if no PIN set). Biometric prompt comes from RN.
3. **Home** — top: business switcher; two summary cards (Receivable RED, Payable GREEN).
   Two tabs: **Customers** | **Cashbook**.
   - Customers tab: searchable list, each row = name + balance (color-coded). "+ Add Customer" FAB.
   - Cashbook tab: running net at top, list of in/out entries, "+ Cash In / + Cash Out".
4. **Party ledger** — header with party name + big balance + Remind/Share buttons.
   Chronological entries with per-entry running balance. Two large fixed bottom buttons:
   **YOU GAVE** (red) / **YOU GOT** (green).
5. **Add entry sheet** — amount keypad first (autofocus), then note, photo, date, optional due date.
   Amount is the only required field. Save = optimistic, instant.
6. **Add party** — name + phone, or "Import from contacts" (calls RN bridge).
7. **Cashbook entry sheet** — amount, in/out, category, note, photo, date.
8. **Reports** — date-range picker, summary cards, sales/purchase breakdown,
   "Download PDF" + "Download Excel" + share.
9. **Invoices** — list + create (line items, auto total) + view/share PDF.
10. **Inventory** — item list with low-stock badges, add/edit, stock in/out.
11. **Settings** — business management, language toggle, set/change PIN, logout.

UX non-negotiables:
- Adding a ledger entry from home = max 3 taps (party → button → amount → save).
- Optimistic updates: UI reflects the change before the network responds.
- Number keypad (`inputmode="numeric"`) for all amount fields.
- Detect the RN bridge; degrade gracefully in a plain browser (share → Web Share API
  or copy link; contacts → manual entry). The webapp must be fully usable without RN.

---

## 9. Mobile shell (Expo React Native) — thin wrapper only

No product screens, no business logic here. Just the shell:

- Single full-screen `react-native-webview` pointing at `EXPO_PUBLIC_WEBAPP_URL`.
- Android hardware back button → WebView goBack when possible.
- JS bridge (`postMessage` / `onMessage`) exposing native capabilities to the webapp:
  - `share(text|file)` → native share sheet.
  - `pickContact()` → returns `{ name, phone }` for "Import from contacts".
  - `biometricUnlock()` → expo-local-authentication, gates the app on launch.
  - `getPushToken()` (optional, for reminders later).
- Pull-to-refresh, loading + offline error states.
- App icon + splash placeholders.

---

## 10. Deliverables

- `docker-compose.yml` running Postgres + backend + webapp with one command.
- `.env.example` at the root and in each app; README with setup steps.
- Seed data (in `packages/database`) so logging in shows a populated ledger instantly.
- `pnpm dev` at root runs `turbo run dev` and starts db + backend + webapp together.
- `pnpm build`, `pnpm lint`, `pnpm test` work from the root via Turborepo.

---

## 11. Build Plan (do in this order; verify each before moving on)

**Phase 0 — Monorepo scaffold.** Turborepo + pnpm workspaces. Create `apps/*` and
`packages/*` skeletons, `turbo.json`, shared `tsconfig`/`eslint-config`, root scripts.
Stand up empty `@khatabook/shared` and `@khatabook/database` packages.
✅ Check: `pnpm install` resolves the workspace; `pnpm build` runs turbo across empty
packages with no errors; `pnpm dev` boots the placeholder webapp + backend.

**Phase 1 — DB (`packages/database`).** Prisma schema (with client-UUID ids +
`updatedAt`/`deletedAt`) + migrations + seed. Export the Prisma client.
✅ Check: `prisma migrate dev` succeeds; seed inserts demo data; `prisma studio` shows it.

**Phase 1b — Shared logic (`packages/shared`).** Money helpers + balance functions
(§5) + zod schemas + shared types. Unit tests for the balance math.
✅ Check: `pnpm test --filter=@khatabook/shared` passes; receivable/payable/running-
balance functions return correct values on sample data.

**Phase 2 — Backend (`apps/backend`).** Auth, businesses, parties, transactions,
ledger+balance (using `@khatabook/shared`), cashbook, reports summary, uploads, /health.
Enforce tenant isolation on every route. Validate with shared zod schemas.
✅ Check: `/health` = 200; can OTP-login as the demo user; `GET /parties/:id/ledger`
returns correct running balance; receivable/payable totals match seed math; a request
for another user's party returns 403/404.

**Phase 3 — Webapp core (`apps/webapp`).** Login, Home (Customers + Cashbook), Party
ledger, Add-entry sheet, Add party. Online-first with local cache. Optimistic updates.
Scaffold next-intl (English filled in). Balances computed via `@khatabook/shared`.
✅ Check: full credit/debit flow works in the browser at phone width; balances update live.

**Phase 4 — Reports, PDF, Excel.** Summary, party statement PDF, XLSX export, sharing.
✅ Check: downloads open and show correct numbers.

**Phase 5 — Invoices + Inventory.** Create/share invoice PDF; inventory with low-stock alerts.
✅ Check: invoice total math correct; low-stock badge appears at threshold.

**Phase 6 — RN shell (`apps/rnapp`).** WebView + back button + share/contact/biometric
bridge. Nothing else.
✅ Check: app boots, loads webapp, contact import + share work via the bridge.

**Phase 7 — Offline sync.** Dexie local store (+ client `syncStatus`), sync queue,
`/sync/pull` + `/sync/push`, last-write-wins by `updatedAt`, tombstone deletes. App lock
+ Hindi i18n.
✅ Check: airplane-mode add an entry → it persists and syncs on reconnect.

---

## 12. Acceptance criteria (the clone is "done" when)

- Login with phone+OTP, land on a populated home screen.
- Add a customer, record "YOU GAVE ₹500" and "YOU GOT ₹200" → balance shows "₹300 due" in red.
- Home receivable/payable totals are correct and update live.
- Cashbook in/out works with categories and a correct net.
- Download a party statement PDF and a summary Excel with correct figures.
- Create and share an invoice PDF.
- Inventory shows a low-stock badge at threshold.
- RN app loads the webapp, imports a contact, and shares a statement natively.
- Add an entry offline → it survives and syncs when back online.
- App is fast: adding a ledger entry is ≤ 3 taps and feels instant.
- The webapp works fully in a plain mobile browser with no RN shell present.

Keep it simple and clean. Prioritize a fast, smooth ledger-entry experience over feature
completeness where they conflict. Web-first: the webapp is the product, the RN app is a
shell. Use TypeScript everywhere.

Run each step and verify it works (migrations apply, server boots, /health returns 200)
before continuing — pasting "proceed to step N" keeps it from generating a huge unverified
blob. Claude Code is the right tool for the heavy iteration; you're set up well by scoping
it into phases.
