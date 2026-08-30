# GawEEE — Build TODO

Source docs: [prd.md](prd.md) · [roadmap.md](roadmap.md) · [design-system.md](design-system.md)

Legend: `[ ]` pending · `[x]` done · `[!]` needs user input/credentials before it can proceed (secrets, real accounts, deploy approval) — everything else is buildable/testable locally with mocks and will be pushed forward autonomously.

---

## Phase 0 — Repo & Tooling Bootstrap
- [x] Save PRD / roadmap / design-system docs
- [x] Create this todo.md
- [x] `git init`, connect to GitHub remote, initial commit + push
- [x] Scaffold Next.js 16 (App Router) + TypeScript + Tailwind v4 project
- [x] Install core deps: Supabase JS client, Zustand, React Query, Zod (validation)
- [x] `.env.example` with all vars from roadmap.md §2.3 (no real secrets committed)
- [x] ESLint config (from create-next-app)
- [x] Base folder structure per roadmap.md §3.1 (app/, components/, lib/, database/)
- [x] Supabase project created (`nwzbzbehdxatnuymmjgg`, region auto-selected), all 12 migrations run,
      `.env.local` configured. **Verified end-to-end against the live project**: signup → login →
      create product → adjust stock → POS sale (atomic, stock deducted correctly) → oversell rejected
      (409) → daily report accurate → void restores stock → unauthenticated requests rejected (401) →
      full PO cycle (draft→submit→approve→receive, stock incremented). Note: "Confirm email" is
      currently **disabled** in Supabase Auth settings (no SMTP configured yet) so signup completes
      without email verification — re-enable once SendGrid/custom SMTP is set up for production.

## Phase 1 — Sprint 1: Foundation & Auth (roadmap.md Sprint 1)
- [x] Database schema migration files (companies → outlets → users → products/inventory →
      invoices/payments → purchasing → financial → HR → audit → views → functions → RLS)
      in `database/migrations/001`–`011`, fixing several bugs in the PRD's raw SQL along the way
      (cross-table generated columns, missing `TODAY()`, FK ordering)
- [x] Supabase client setup (`lib/supabase/client.ts`, `server.ts` browser/server/admin clients)
- [x] Auth API routes: register (atomic company/outlet/owner provisioning via RPC), login, logout, refresh, me
- [x] Auth UI: signup form, login form, validation, protected-route middleware (`middleware.ts`)
- [ ] Onboarding flow (outlet info → products → payment methods → invite staff) — register currently
      auto-creates one default outlet; the multi-step wizard from design-system.md §3.3 is still open
- [x] Landing page (hero, pain points, features, pricing, FAQ, footer) per design-system.md §2
- [x] Dashboard shell: Header + Sidebar (full menu tree from design-system.md §5.2) + layout + live KPI overview
- [ ] Unit tests: auth utilities/validation
- [ ] Integration tests: login/signup flow (MSW mocks)
- [x] `npm run build` passes clean (TypeScript strict, no errors)

## Phase 2 — Sprint 2: POS & Inventory (roadmap.md Sprint 2)
- [x] DB migrations: products, product_categories, inventory, inventory_ledger, stocktakes (already
      landed in Phase 1's migration batch, 002_products_inventory.sql)
- [x] POS layout (desktop 2-column; mobile falls back to stacked via the same grid) per design-system.md §4
- [x] Product search + barcode input, shopping cart state (Zustand `posStore`)
- [x] Invoice creation API (`/api/invoices`) — atomic via `create_invoice()` SQL function
      (012_create_invoice_function.sql), not the sequential-REST-calls sketch in prd.md, which had
      no rollback path if inventory deduction failed after the invoice row was written
- [x] Payment method selection UI: cash / e-wallet (mock QR) / bank transfer (mock VA), backed by
      `/api/payments/initiate` + a demo-only `/api/payments/:id/simulate-success` endpoint standing
      in for the real webhook until Doku/Bank credentials exist
- [x] Real webhook handlers scaffolded (`/api/payments/webhook/{doku,bank}`) with HMAC signature
      verification — return 501 until `DOKU_SECRET_KEY`/`BANK_VA_SECRET` are set
- [x] Cash payment flow with change calculation
- [x] Receipt generation (screen + print-friendly `window.print()`; no PDF/storage yet)
- [x] Invoice void flow (`void_invoice()` SQL function + `/api/invoices/:id/void`, manager+ only, 24h window)
- [x] Inventory API: list (`/api/inventory/:outletId`, with search/barcode/status filters), adjust; low-stock via `alert_status`
- [x] Inventory dashboard UI (stock table, search, status filter, stock/retail value totals)
- [x] Sales/Invoice dashboard UI (`/dashboard/sales` today's transactions, `/dashboard/sales/invoices`
      full history, `/dashboard/sales/[invoiceId]` detail with void button) — these sidebar links
      existed since Sprint 1 but had no page behind them (404) until now
- [ ] Real-time inventory sync via Supabase Realtime channel — not wired up yet, table just refetches on filter change
- [x] E2E test: full POS transaction (scan → pay → receipt) — Playwright set up (`npm run test:e2e`),
      5 tests passing against the live dev server + real Supabase project (login errors, signup
      validation, landing page links, a full cash sale through the actual UI, empty-cart guard).
      Credentials come from `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`/`E2E_TEST_PRODUCT_BARCODE` env vars
      (set in `.env.local`, not committed) rather than being hardcoded in the spec file. Not wired
      into CI yet since that needs these as GitHub Actions secrets — not something I can add myself.
      Void-flow E2E coverage still missing (no automated test yet, but the manual flow works — see below).
- [!] Sidebar's "Stok Rendah" link points at `/dashboard/inventory/low-stock`, not yet built (use the
      status filter on `/dashboard/inventory` for now)

## Phase 3 — Sprint 3: Financial & Supplier (roadmap.md Sprint 3)
- [x] DB migrations: chart_of_accounts, journal_entries, journal_entry_details, daily_financial_summary,
      accounts_receivable/payable (landed in Phase 1's migration batch, 005_financial.sql)
- [ ] Journal entries API — schema exists, no route/UI writes to it yet; daily-summary/p-and-l are
      computed live from invoices instead (see note below), so nothing currently populates
      chart_of_accounts/journal_entries
- [x] Financial dashboard UI (`/dashboard/financial`: KPI cards, sales breakdown, cash position)
- [x] Daily summary (`/api/reports/daily-summary`), P&L (`/api/reports/p-and-l`), and cash position
      (`/api/reports/cash-position`) endpoints — computed live from invoices/invoice_items/
      payment_transactions rather than read from daily_financial_summary, since nothing populates
      that table yet (needs a nightly job — Phase 2 scheduling infra, out of scope for now)
- [x] DB migrations: suppliers, purchase_orders, po_items, purchase_invoices, purchase_payments
      (004_purchasing.sql)
- [x] Supplier CRUD API (`/api/suppliers`, `/api/suppliers/:id`) + list/add UI (`/dashboard/suppliers`)
- [x] Purchase order create/submit/approve/receive flow (`/api/purchase-orders/...`), inventory
      increased via `update_inventory()` on receipt — sequential calls rather than one atomic SQL
      function like invoices, since a partial failure here just needs a manual re-run (documented
      in the route's comment)
- [x] Purchase order UI (`/dashboard/suppliers/purchase-orders`: list, create form, submit/approve/receive
      actions) — full draft→submit→approve→receive cycle tested end-to-end against the live Supabase
      project, stock correctly incremented on receipt
- [ ] Tax report calculation (PPN/PPh) — not started
- [ ] Integration test: transaction → journal entry → P&L accuracy — no journal entries are written
      yet (see above), so this can't be meaningfully tested until that's wired up

## Phase 4 — Sprint 4: Multi-outlet, Admin & Payment Gateways (roadmap.md Sprint 4)
- [x] Master Admin dashboard + sidebar (design-system.md §6) — outlet performance leaderboard,
      users, bulk operations, audit log, each gated to `role === 'master_admin'`
- [x] Bulk operations API (price update) + audit logging — **executes immediately**, not scheduled:
      no cron/queue infra exists yet, so `scheduled_for` from the PRD spec isn't honored
- [x] User management API/UI (invite via Supabase Admin API, deactivate, reset password)
- [x] Company-wide audit log viewer
- [!] Doku Pay integration — **needs real/sandbox merchant ID + secret key from user**; webhook
      handler is scaffolded with HMAC verification and returns 501 until `DOKU_SECRET_KEY` is set
- [!] Bank Virtual Account integration — **needs bank/aggregator sandbox API key**; same
      scaffolded-and-501-until-configured approach as Doku
- [x] Webhook handlers (`/api/payments/webhook/doku`, `/bank`) with HMAC signature verification
- [x] RLS policies for all tables (cashier / outlet_manager / master_admin) per prd.md §6.1 —
      landed in Phase 1 (010_rls_policies.sql)
- [ ] Error handling, loading states, UI polish pass — basic states exist per-component, no
      dedicated pass yet (no toast/notification system, no global error boundary)

## Phase 5 — QA, Deploy & Launch Prep
- [ ] Full unit + integration + E2E suite green, coverage ≥ 80% (unit tests exist for utils only;
      no integration/E2E suite yet)
- [!] Local dev database — roadmap.md's plain `docker-compose.yml` (bare `postgres:15-alpine`) won't
      actually work with this schema: migrations reference `auth.users` and RLS policies call
      `auth.uid()`, both provided by Supabase's auth stack, not vanilla Postgres. Local dev needs the
      **Supabase CLI** (`supabase init && supabase start`) instead, which runs the full stack
      (Postgres + GoTrue auth + PostgREST) locally via Docker — not yet set up, needs Docker Desktop
- [x] GitHub Actions CI (lint, test, build) — added, runs on push/PR to main/develop
- [!] GitHub Actions CD (deploy to staging/production) — **needs Vercel project + secrets (VERCEL_TOKEN, org/project IDs) and confirmation before wiring auto-deploy**
- [!] Production Supabase project + domain + Sentry/DataDog — **needs accounts/credentials from user**
- [!] Beta customer onboarding, load testing against real infra, security pentest — **operational/business steps, not code tasks; flag when engineering side is ready**

---

## Notes on scope
This todo tracks the **engineering deliverables** of the PRD (a working Next.js + Supabase codebase
implementing Phase 1 features, with payment gateways behind a swappable mock interface). Items marked
`[!]` are blocked on secrets, accounts, or approvals only the user can provide — everything else will be
built incrementally and reported as it lands, in commits pushed to the connected GitHub repo.
