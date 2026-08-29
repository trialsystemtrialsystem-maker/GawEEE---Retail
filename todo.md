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
- [!] Supabase project (URL + anon key + service role key) — **needs user to create a Supabase project and share credentials**, or approve using local Supabase CLI / mock mode for now

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
- [ ] DB migrations: products, product_categories, inventory, inventory_ledger, stocktakes
- [ ] POS layout (mobile + desktop) per design-system.md §4
- [ ] Product search + barcode input, shopping cart state (Zustand `posStore`)
- [ ] Invoice creation API (`/api/invoices`) with inventory lock + deduction + journal entry stub
- [ ] Payment method selection UI: cash / e-wallet (mock QR) / bank transfer (mock VA)
- [ ] Cash payment flow with change calculation
- [ ] Receipt generation (screen + print-friendly view)
- [ ] Inventory API: list, get, adjust; low-stock alert view
- [ ] Inventory dashboard UI (stock table, filters, alerts)
- [ ] Real-time inventory sync via Supabase Realtime channel
- [ ] E2E test: full POS transaction (scan → pay → receipt), void flow

## Phase 3 — Sprint 3: Financial & Supplier (roadmap.md Sprint 3)
- [ ] DB migrations: chart_of_accounts, journal_entries, journal_entry_details, daily_financial_summary, accounts_receivable/payable
- [ ] Journal entries API + P&L calculation service
- [ ] Financial dashboard UI (tabs: Ringkasan, Penjualan, Keuangan)
- [ ] Daily summary + cash position endpoints
- [ ] DB migrations: suppliers, purchase_orders, po_items, purchase_invoices, purchase_payments
- [ ] Supplier CRUD API + UI
- [ ] Purchase order create/approve/receive flow (with inventory increase on receipt)
- [ ] Tax report calculation (PPN/PPh) — informational only, not filed anywhere
- [ ] Integration test: transaction → journal entry → P&L accuracy

## Phase 4 — Sprint 4: Multi-outlet, Admin & Payment Gateways (roadmap.md Sprint 4)
- [ ] Master Admin dashboard + sidebar (design-system.md §6)
- [ ] Bulk operations API (price update, scheduled execution) + audit logging
- [ ] User management API/UI (add/edit/deactivate, reset password)
- [ ] Company-wide audit log viewer
- [!] Doku Pay integration — **needs real/sandbox merchant ID + secret key from user**; build against mock interface now, swap in when credentials provided
- [!] Bank Virtual Account integration — **needs bank/aggregator sandbox API key**; same mock-first approach
- [ ] Webhook handlers (`/api/payments/webhook/doku`, `/bank`) with signature verification
- [ ] RLS policies for all tables (cashier / outlet_manager / master_admin) per prd.md §6.1
- [ ] Error handling, loading states, UI polish pass

## Phase 5 — QA, Deploy & Launch Prep
- [ ] Full unit + integration + E2E suite green, coverage ≥ 80%
- [ ] `docker-compose.yml` for local Postgres/Redis/Mailhog
- [ ] GitHub Actions CI (lint, test, build) — safe to add now
- [!] GitHub Actions CD (deploy to staging/production) — **needs Vercel project + secrets (VERCEL_TOKEN, org/project IDs) and confirmation before wiring auto-deploy**
- [!] Production Supabase project + domain + Sentry/DataDog — **needs accounts/credentials from user**
- [!] Beta customer onboarding, load testing against real infra, security pentest — **operational/business steps, not code tasks; flag when engineering side is ready**

---

## Notes on scope
This todo tracks the **engineering deliverables** of the PRD (a working Next.js + Supabase codebase
implementing Phase 1 features, with payment gateways behind a swappable mock interface). Items marked
`[!]` are blocked on secrets, accounts, or approvals only the user can provide — everything else will be
built incrementally and reported as it lands, in commits pushed to the connected GitHub repo.
