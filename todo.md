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
- [x] Onboarding flow (outlet info → products → payment methods → invite staff) — migration 058 run;
      live-verified end-to-end against a fresh company (provisioned the same way `register()` does, so it
      post-dates the migration and isn't backfilled): login redirects a new `master_admin` into
      `/onboarding` instead of `/dashboard`; all 5 steps confirmed working, each checked against the
      actual database row it's supposed to write (outlet name/address/opening_cash, the added product,
      `enabled_payment_methods`, the invited staff account), finishing sets `onboarding_completed_at` and
      lands on `/pos`, and revisiting `/dashboard` afterward no longer redirects back into the wizard.
      `OnboardingWizard` (`/onboarding`) implements all 5 steps from design-system.md §3.3, reusing
      existing endpoints (`PATCH /api/outlets/:id`, `POST /api/products`, `POST /api/admin/users`) rather
      than new ones; steps 2 (products) and 4 (invite staff) are skippable per spec, and step 4 shows each
      invited staff member's temp password inline since there's no real email delivery to rely on.
      Verification found one real bug: none of the wizard's `Input` fields had a `name`/`id`, so their
      `<label>` never got a matching `htmlFor` — broke real screen-reader label association, not just
      Playwright's `getByLabel`. Fixed by naming every field.
- [x] Landing page (hero, pain points, features, pricing, FAQ, footer) per design-system.md §2
- [x] Dashboard shell: Header + Sidebar (full menu tree from design-system.md §5.2) + layout + live KPI overview
- [x] Unit tests: auth utilities/validation — `signUpSchema`/`loginSchema` already covered in
      `tests/unit/lib/validation.test.ts`; added `tests/unit/lib/auth-context.test.ts` (`canAccessOutlet`
      role/outlet matrix) and `tests/unit/lib/errors.test.ts` (`handleDatabaseError` Postgres error-code
      mapping, `ApiError`) to close the remaining gap. 26/26 unit tests passing.
- [x] Integration tests: login/signup flow — resolved the deliberately-deferred decision (teardown step,
      not a separate sandbox project — no such project exists to set up, see Phase 5's "Local dev database"
      note for the same underlying constraint). New `tests/e2e/signup-login-roundtrip.spec.ts`: signs up a
      real throwaway company through the actual UI, logs out (since `signUp()` already leaves an
      authenticated session — found live: `/auth/login` just redirects straight past the login form via
      middleware without an explicit logout first), logs back in, confirms it lands in `/onboarding` as a
      fresh `master_admin` (not `/dashboard`), then deletes the outlet/company/auth user via the
      service-role admin client in `afterEach` regardless of pass/fail — confirmed no orphaned row
      afterward. Skips itself if `SUPABASE_SERVICE_ROLE_KEY` isn't set, same guard style as `pos.spec.ts`.
      Passed clean in isolation; found live that it shares `POST /api/auth/register`'s IP rate limit
      (5/hour, Phase 16) with the pre-existing mismatched-password test in `auth.spec.ts` — documented
      there rather than touching the rate limiter itself.
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
- [x] Real-time inventory sync via Supabase Realtime channel — migration 057 run; live-verified via
      Playwright: adjusted stock through a separate API call (no page reload, no filter touch) and
      confirmed the on-screen quantity updated on its own. `InventoryTable` subscribes to
      `postgres_changes` on `inventory` filtered by `outlet_id`, debounced 400ms to coalesce bursts (a
      multi-item sale updates one row per item), and reloads silently (no full-table loading flash).
      Verification surfaced one real bug: `postgres_changes` subscriptions are RLS-gated per event, and
      the browser client doesn't hand its session token to the realtime socket automatically — without an
      explicit `supabase.realtime.setAuth(session.access_token)` before subscribing, every row is
      evaluated as the anonymous role, `user_can_access_outlet()` denies it, and the channel reports
      `SUBSCRIBED` while silently delivering zero events. Fixed by reading the session via
      `supabase.auth.getSession()` and calling `setAuth()` before opening the channel.
- [x] E2E test: full POS transaction (scan → pay → receipt) — Playwright set up (`npm run test:e2e`),
      5 tests passing against the live dev server + real Supabase project (login errors, signup
      validation, landing page links, a full cash sale through the actual UI, empty-cart guard).
      Credentials come from `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`/`E2E_TEST_PRODUCT_BARCODE` env vars
      (set in `.env.local`, not committed) rather than being hardcoded in the spec file. Not wired
      into CI yet since that needs these as GitHub Actions secrets — not something I can add myself.
      Void-flow E2E coverage still missing (no automated test yet, but the manual flow works — see below).
- [x] "Stok Rendah" links (`NotificationBell`, dashboard KPI card) — resolved: they already point at
      `/dashboard/inventory?status=low_stock`, which `InventoryTable` reads from the URL to pre-select
      the status filter. No sidebar entry or code anywhere links to the old `/dashboard/inventory/
      low-stock` path (`lib/nav/config.ts` only ever links plain `/dashboard/inventory`) — this note was
      stale, likely resolved during the Phase 9 sidebar rebuild without being updated here. Live-verified
      via Playwright: the filtered URL loads, the status `<select>` is pre-set to `low_stock`, and
      matching rows render.

## Phase 3 — Sprint 3: Financial & Supplier (roadmap.md Sprint 3)
- [x] DB migrations: chart_of_accounts, journal_entries, journal_entry_details, daily_financial_summary,
      accounts_receivable/payable (landed in Phase 1's migration batch, 005_financial.sql)
- [x] Journal entries API — this note was stale: `create_journal_entry()`/`post_journal_entry()`
      (`014_accounting_functions.sql`) plus a full CRUD API (`app/api/accounting/{accounts,
      journal-entries,ledger,reports}`) and UI (`JournalEntryManager` at `/dashboard/accounting/journal`)
      already exist, with a default Indonesian-retail chart of accounts seeded on every outlet. Live
      -verified: accounts API returns the seeded COA, a balanced manual entry can be created through the
      UI. Petty Cash "mark as paid" (`036_petty_cash.sql`) also optionally posts a journal entry
      (Dr Beban Operasional / Cr Kas) when an expense is disbursed. Sales now auto-post too (see migration
      059 below) — purchase-order receiving still doesn't, that's a smaller separate follow-up. daily
      -summary/P&L stay computed live from invoices rather than from posted journal entries (see below) —
      that's an intentional, separate design choice already documented there, not a gap in this item.
- [x] Auto-post journal entries from sales (`059_auto_post_journal_entries.sql`) — migration run;
      live-verified with a full regression pass through the real POS UI (not just a check that entries
      appear), given the blast radius of triggers on every sale: a cash sale posts a balanced revenue
      entry debiting Kas plus a balanced HPP entry; an e-wallet sale posts its revenue entry debiting
      Piutang Usaha (not Kas) while still pending, then simulating settlement posts a balanced
      reclassification entry into Bank; a bank-transfer sale round-trips the same way; voiding the cash
      sale reversed every entry posted for it (status flipped to `reversed`, mirrored `void`-tagged
      entries posted, and the net debit/credit per account across original+reversal came out to exactly
      zero). Also timed a full demo reseed (722 invoices, the genuinely-empty blocking path) to check the
      new per-invoice trigger overhead: 19.4s, inside the ~15-25s baseline already documented for that
      path, with 720 correctly-posted entries and zero errors — no meaningful performance regression.
      Three triggers on `invoices`, not changes to `create_invoice()`/`void_invoice()` themselves (same
      "additive calls, not function changes" precedent as Petty Cash): (1) a deferred constraint trigger
      on INSERT posts a revenue entry (Dr Kas if `payment_status='paid'` i.e. cash, else Dr Piutang Usaha
      for e-wallet/bank still pending) plus a separate HPP entry from `invoice_items.cost_of_goods_sold`;
      (2) an UPDATE trigger reclassifies Piutang Usaha into Bank once a pending payment settles; (3) an
      UPDATE trigger reverses every posted entry tagged to an invoice when it's voided, by mirroring
      debit/credit rather than deleting. Every function is wrapped in an exception handler that logs a
      warning and returns rather than raising — since the INSERT trigger is deferred to commit-time, an
      unhandled exception there would roll back the sale itself, so a bookkeeping bug must never be able
      to block or undo an actual transaction. Also added a `journal_entries` wipe step to the demo seed
      route (`source_id` has no FK, so it wouldn't get cleaned by the existing `invoices` delete, and
      would accumulate across reseeds). Purchase-order receiving still doesn't auto-post — a smaller,
      separate follow-up if wanted.
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
- [x] Tax report calculation (PPN) — this note was stale: `/api/reports/tax-report` +
      `TaxReport` (`/dashboard/financial/tax-report`) already exist, aggregating `invoices.tax_amount`
      (computed at sale time by `create_invoice()`) by month. Live-verified: real, non-empty rows and a
      correct total from demo data. PPh (income tax) is out of scope — that's a company-level annual
      calculation on net profit, not a per-transaction one, and needs a decision on which PPh regime
      (Final PPh 0.5% UMKM vs. normal rates) applies before it's buildable.
- [x] Automated integration test: transaction → journal entry → P&L accuracy — promoted the one-off manual
      regression pass into a committed `tests/e2e/journal-accounting-integration.spec.ts`. Runs against the
      public demo tenant credentials (not gated behind `E2E_TEST_*` env vars like `pos.spec.ts`, since
      these are not secret — keeps it actually running instead of silently skipping): a real cash sale via
      the POS UI, then asserts a `posted` journal entry exists with `source_type='sales'` and the exact
      description `post_invoice_journal_entry()` writes (`Penjualan ${invoice_number}`), and that
      `GET /api/accounting/reports?type=profit-loss`'s `totalIncome` increased by exactly
      `subtotal - discount_amount` (the revenue line's credited amount, not the tax-inclusive total).
      Passed clean.
- [x] Financial dashboard sub-pages: `/dashboard/financial/cash-position` (KPI cards + recent cash
      transactions) and `/dashboard/financial/reports` (P&L with a date-range picker) — both were
      linked from the sidebar since Sprint 1 but 404'd until now
- [x] Product management UI (`/dashboard/inventory/products`: list + create form)
- [x] Audited every sidebar link against actual pages — found and fixed 12 more 404s beyond the
      Sales gap above. Real pages added where the backend already existed (the three above); an
      honest "belum tersedia" placeholder (`components/common/ComingSoon.tsx`) for features with no
      backend at all yet (tax report, stocktake, outlet settings, payment-method settings, staff,
      attendance, supplier invoices); and two redirects for pages that would've just duplicated an
      existing one (`/dashboard/settings/users` → `/dashboard/admin/users`,
      `/dashboard/reports/daily` → `/dashboard/financial`). All 53 routes verified 200/307 (never
      404) against the live dev server.

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
- [x] Error handling, loading states, UI polish pass — this note was stale: a toast/notification system
      (`store/notificationStore.ts` + `components/common/Toaster.tsx`, used in 68 components) and a
      global error boundary (`app/error.tsx`) both already exist. Confirmed working — a journal entry
      created through `JournalEntryManager` (live-verified earlier this session) goes through this same
      `showToast()` call on success.

## Phase 5 — QA, Deploy & Launch Prep
- [x] Full unit + integration + E2E suite green — this note was stale (an E2E suite already existed,
      `tests/e2e/`, predating this note). Current state: 53/53 unit tests passing (up from 39; added
      `productIcon.test.ts` and `exportCsv.test.ts` — the latter required extracting a `rowsToCsv()` pure
      function out of the browser-only `exportToCsv()` so the escaping rules are testable without DOM
      APIs, a non-behavior-changing refactor), and all 7 E2E specs pass when run individually against a
      clear rate-limit window (`journal-accounting-integration.spec.ts` and
      `signup-login-roundtrip.spec.ts` new this pass, both above). Two real pre-existing test bugs found
      and fixed along the way: `pos.spec.ts` asserted `PEMBAYARAN BERHASIL` (uppercase) against actual text
      `Pembayaran Berhasil!` (mixed case) — silently broken since whenever it was written, only ever
      skipped in practice; and a stale comment on `auth.spec.ts`'s mismatched-password test called it a
      client-side check when the password-match rule is actually server-side (`signUpSchema`'s `.refine()`)
      — cosmetic (the test still passed), but the comment was actively misleading about what's covered
      where. Also fixed `playwright.config.ts`'s `fullyParallel: false`, which only serializes tests
      *within* one file — adding two more spec files exposed real cross-file races (shared login
      session/cart state) that made `pos.spec.ts`/`auth.spec.ts` flake when run together; set `workers: 1`
      to serialize across files too, since these are stateful E2E tests against one shared backend, not
      independent unit tests. **Not** at ≥80% coverage — this was meaningful incremental expansion (as
      every prior test-coverage entry in this file has been), not a full coverage push; no coverage
      tooling is wired up to measure the actual percentage.
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

## Phase 6 — Visual redesign, demo data, and analytics (ad hoc user request)
- [x] Redesigned brand color to a deep navy (`--brand-900`/`--brand-950` gradient sidebar, richer
      header/KPI cards) + adopted the dataviz skill's validated CVD-safe 8-color categorical palette,
      status palette, and sequential blue ramp as CSS custom properties in `globals.css`
- [x] Demo data generator (`lib/demo/catalog.ts` + `app/api/demo/seed/route.ts`, public/unauthenticated
      — it's the landing page's "Coba Demo" button): resets and regenerates a fixed demo tenant
      ("Toko Frozen Fresh Demo") with 24 frozen-food products, 4 suppliers, ~700 invoices across 90
      days of history (growth trend + weekday/weekend variation), matching payments, 16 purchase
      orders covering every status the UI shows (draft/pending_approval/ordered/received), 2 voided
      invoices, a manual stock adjustment, and low/out-of-stock alerts on 2 intentionally lean
      products — touches every module with working UI (POS, inventory, sales, suppliers/PO, financial
      reports, admin/audit log). Found and fixed a real bug during testing: the first version's
      starting stock was sized almost exactly to total demand, so every product hit zero simultaneously
      ~9 days before "today," leaving a dead gap with no recent transactions — fixed by resizing stock
      and restock schedule to a ~2x safety margin (verified: latest invoice now lands today, only the
      2 intentionally-lean products show low/out-of-stock).
- [x] `GET /api/reports/sales-trend`: daily revenue/profit series + current-vs-previous-period
      comparison + revenue-by-category breakdown, backing the new chart components
- [x] Chart components (`components/charts/`) built per the dataviz skill: `SalesTrendChart` (line,
      one axis, 2 categorical series in fixed slot order, legend, hover tooltip), `CategoryBreakdownChart`
      (bar, stable per-category color independent of sort rank, direct labels), `ComparisonKPIRow`
      (status-colored up/down delta badges, not categorical hues) — wired into both `/dashboard` and
      `/dashboard/financial`
- [x] Fixed a pre-existing bug found while wiring this up: the main `/dashboard` overview read the
      `daily_financial_summary` table, which nothing has ever populated (see Sprint 3 note above) — it
      always showed zeros regardless of real sales. Now uses the same live-computed endpoint as the
      financial dashboard.
- [x] Fixed a display bug in the Purchase Order list: it rendered `created_at` (DB insert time — always
      "today" for seeded/backdated rows) instead of `order_date` (the actual order date) in the date
      column, and sorted by the same wrong field.
- [x] Color redesign systematic pass — mechanically swapped every exact-match Tailwind `blue-{50,100,500,
      600,700,800,900}` utility class for the equivalent `brand-{...}` token (`app/globals.css`'s `@theme`
      block already registers `--color-brand-*` for each of these steps, so `bg-brand-500` etc. were
      already valid utilities, just unused outside a handful of files) across `components/` and `app/` —
      ~78 files, every remaining hardcoded blue instance found by grep. Left `blue-200/300/400` alone
      (no exact brand step exists for these — approximating one risked a worse result than the status quo).
      Typecheck/lint/build clean; spot-checked 5 representative pages (landing, login, dashboard, journal
      list, POS) via Playwright screenshots — all render correctly with the unified navy palette, no
      layout breakage, confirming this was a pure hue swap as intended.
- [x] Full click-through audit of every sidebar link + all 6 "Fitur Unggulan" landing-page claims
      against the live demo account, prompted by user report that POS "wasn't there." Found and fixed:
      - **Real-time POS had no sidebar link at all** — the page worked (E2E-tested since Sprint 2) but
        was only reachable by typing `/pos` directly, so it looked missing. Added "Kasir (POS)" as the
        first sidebar item.
      - **POS had no way back to the dashboard** — its minimal layout had zero navigation. Added a
        "← Kembali ke Dashboard" bar.
      - **Multi-outlet Support had no way to add an outlet** — Master Admin could only view the single
        outlet created at signup, nothing to actually manage. Added `POST /api/admin/outlets` +
        a "+ Tambah Outlet" form; verified a second outlet now appears correctly in the leaderboard.
      - Confirmed working as-is: Inventory Management, Financial Reports, Compliance Ready (audit log
        has real entries), and Payment Integration (e-wallet/bank mock flow, clearly labeled as demo
        mode pending real Doku/Bank credentials — see Phase 4).
- [x] "Coba Demo" was slow (~20s) on every click, because it unconditionally wiped and regenerated
      the full 90-day dataset even when nothing had changed. Added a fast path: if the tenant's most
      recent invoice is already dated today (true right after any seed, since the generator always
      backdates its last invoice to "today"), skip straight to returning the login instead of
      reseeding — full reseed still runs automatically once the data goes stale (next calendar day).
      Verified: ~20s -> ~1s for a same-day repeat click.
- [x] User reported the whole app (not just the demo seed) still felt slow after the fast-path fix
      above. Found two systemic causes and fixed both:
      1. **Redundant network auth verification.** `supabase.auth.getUser()` re-verifies the JWT
         against Supabase's Auth server over the network (~1-1.5s) every time it's called. It was
         being called once in `proxy.ts` middleware (correct — this is the real security boundary,
         run on every request) *and again* redundantly in `getAuthContext()` (used by nearly every API
         route) and in 12 separate Server Component pages — often 2-3x per single page load. Since
         proxy.ts's middleware already verifies every request before it reaches these pages/routes
         (confirmed: it mutates `request.cookies` and passes the modified `request` into
         `NextResponse.next({ request })`, which is what Next.js forwards downstream in the same
         request — the same pattern Supabase's own SSR docs use), replaced all 13 downstream calls
         with `getSession()` (reads the already-verified cookie, no network round-trip) instead of
         re-verifying from scratch. Verified the security boundary is intact: unauthenticated requests
         to `/api/reports/daily-summary`, `/api/auth/me`, and `/dashboard` still correctly return
         401/401/307 respectively.
      2. **Sequential independent queries.** `/api/reports/daily-summary`, `/api/reports/cash-position`,
         and `/api/admin/outlets` each awaited 3-4 independent Supabase queries one after another
         instead of via `Promise.all`, paying each query's network latency serially. Parallelized all
         three. Found and fixed a real accuracy bug in the same pass: `cash-position`'s "cash on hand"
         total was computed from the same `limit(10)` query used for the "recent transactions" list,
         so it silently undercounted cash on hand for any outlet with more than 10 cash sales — split
         into a separate unlimited query for the total vs. the limited one for display.
      Verified: `/api/auth/me` 3.9s -> 1.6s; full login-to-dashboard-loaded flow (measured via a real
      Playwright browser session, not curl) is ~6.7s total including the ~2s Supabase Auth
      `signInWithPassword` call itself. Full unit + E2E suite green after the change.
- [x] "Coba Demo" was slow again (~15-20s) on the **first click of each new day**, even after the earlier
      same-day fast-path fix, because the fast path only matched when the demo tenant's latest invoice
      was dated *exactly today* — as soon as the calendar rolled over, that check failed and every click
      paid the full wipe-and-regenerate cost again, every day, for whoever clicked first. Root-caused by
      reproducing it directly (backdated the demo tenant's invoices to "yesterday" via the service-role
      REST API, then timed the endpoint: 1.19s before the fix would have been ~20s). Fixed by extracting
      the wipe-and-regenerate logic into `regenerateDemoData()` and changing the response strategy: a
      *genuinely empty* tenant (true first-ever seed) still blocks on the full regenerate since there's
      nothing to show yet, but a merely-*stale* tenant (data exists, just not dated today) now responds
      immediately with its existing data and kicks off the regenerate in the background
      (`void regenerateDemoData(...).catch(...)`, not awaited) so the user is never blocked on it —
      verified live: response dropped from ~20s to ~1.2s for the stale case, and confirmed the background
      job actually completes (latest invoice was re-dated to "today" ~20s later, checked directly via
      the service-role REST API). Known trade-off, low-stakes and left as-is: if two clicks race while
      stale, both fire a background regenerate and could step on each other (sequential deletes, same
      "demo data, partial failure is fine" reasoning as the rest of this seeder); would need a lock or
      a queue to fully close, not worth it for a demo endpoint. Also noted: on a serverless/edge
      deployment (Vercel, still blocked per below) the background task isn't guaranteed to keep running
      after the response is sent — would need `waitUntil()` or a scheduled job instead. Fine on the
      current self-hosted/Node dev setup.
- [!] The demo seed endpoint is public and unauthenticated by design (so it's reachable from the
      landing page without login) but has no rate-limiting — repeated calls just re-seed the same
      fixed tenant (bounded blast radius), but could still be hammered to load the DB. Acceptable for
      a portfolio/demo deployment; would need real rate-limiting before a production launch.

## Phase 7 — Business Suite Modules (Sales Dashboard, Order Online, Booking, Employee, Accounting, WhatsApp)
User pasted 14 reference screenshots from a laundry-service SaaS ("majoo") asking for 6 new dashboard
modules matching that layout. GawEEE is retail/UMKM (not laundry), so domain concepts are adapted to
retail equivalents rather than copied literally; SaaS-billing/infra artifacts from the mockup (quota
widgets, onboarding checklist, real WhatsApp API sending, real push notifications) are intentionally
out of scope. Full plan: `C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`. Shipping as 6
sequential increments, smallest/lowest-risk first:
- [x] 7.1 WhatsApp — `whatsapp_templates`/`whatsapp_broadcasts` tables (migration `013_whatsapp.sql`),
      template CRUD + simulated broadcast (recipient count is real, computed from customers on file;
      sending is not — matches the mockup's own disclaimer), `/dashboard/whatsapp`. Sidebar link added.
      **Needs the user to run `013_whatsapp.sql` in Supabase SQL Editor before it works against the
      live DB** (no direct DB access from this environment — same manual-paste flow as the original
      schema; content is appended to `database/combined_migration.sql`).
- [x] 7.2 Accounting — wired up the previously-unused `chart_of_accounts`/`journal_entries`/
      `journal_entry_details` schema from Phase 1 (migration `014_accounting_functions.sql`):
      `create_journal_entry()` (atomic, single-transaction line-item insert, mirrors `create_invoice()`)
      and `post_journal_entry()` (re-validates balance, locks the row) as Postgres functions; a default
      14-account Indonesian-retail COA seeded on every new outlet via `provision_company_and_owner()`
      and backfilled (idempotent) onto existing outlets. Pages: Dashboard Akuntansi (this-month
      income/expense/net-profit), Chart of Accounts, Jurnal Umum (dynamic dr/cr rows, client-side
      balance check before submit), Buku Besar (per-account running balance), Neraca, Laba Rugi.
      Does not yet auto-post journal entries from sales/purchasing — manual bookkeeping only, tracked
      as a follow-on. **Also needs `014_accounting_functions.sql` run in Supabase SQL Editor.**
- [x] 7.3 Sales Dashboard enhancement — Daily/Weekly/Monthly toggle added to `/api/reports/sales-trend`
      (re-buckets the existing daily series server-side; comparison totals unaffected). New
      `/api/reports/sales-breakdown` + `SalesReportGrid` on the main dashboard: payment method,
      order type (in-store vs online — 0 until 7.4 ships), best-selling products, lowest stock (reuses
      `v_low_stock_alerts`), sales per cashier, commission per cashier (migration `015_sales_commission.sql`
      adds `commission_rate` to `staff_members`, matched to a cashier by email since no direct FK exists
      between `users` and `staff_members`), fraud control (voided-invoice watchlist), sales per
      transaction. **Needs `015_sales_commission.sql` run in Supabase SQL Editor.**
- [x] 7.4 Order Online — `online_orders` table (migration `016_online_orders.sql`, manual entry since no
      live channel integration exists), status-workflow UI at `/dashboard/online-orders` (Incoming →
      On Process → On Delivery → Completed, or Cancel at any non-terminal step; transitions validated
      server-side via `lib/utils/onlineOrders.ts`). Wired into the Sales Dashboard's Order Type card
      (was showing 0 for "Online" as a placeholder — now a real number). **Needs `016_online_orders.sql`
      run in Supabase SQL Editor.**
- [x] 7.5 Appointment/Booking — reframed as pre-order & pickup scheduling (bakery custom-cake orders,
      bulk frozen-food reservations) rather than the literal laundry "appointment" from the mockup,
      keeping the same table shape (Tanggal/Jam/Pelanggan/Layanan/Staf/Status). `bookings` table
      (migration `017_bookings.sql`), status workflow pending → confirmed → in_progress → completed
      (or cancel), `/dashboard/bookings`. Also added `GET /api/staff` (minimal staff picker list —
      full staff CRUD lands in 7.6). **Needs `017_bookings.sql` run in Supabase SQL Editor.**
- [x] 7.6 Employee expansion — migration `018_employee_expansion.sql` (payroll_runs/payslips,
      position_levels, shifts/staff_schedules, staff_announcements, expense_requests, plus
      position_level_id/pin_code on staff_members and geofence_lat/lng/radius_m on outlets).
      Replaced the two `ComingSoon` stubs (Daftar Karyawan, Attendance) with real CRUD/clock-in-out UI.
      New: Payroll (generate a run → one payslip per active staff, base salary + commission computed
      from that period's sales, mark-as-paid), Hak Akses (permission matrix sourced from the actual
      API route gates + role editor reusing the existing `PUT /api/admin/users/:id`), Jadwal Kerja
      (shift list + weekly assignment grid), Notifikasi (in-app announcement log, no real push),
      Persetujuan Pembelian (reuses the existing PO approve endpoint + new reject endpoint),
      Persetujuan Keuangan (new manual expense-approval flow), Radius Absensi (geofence fields added
      to the previously-stubbed Outlet Info settings page, which is now also real). Also replaced the
      generic `ComingSoon` `/dashboard/settings` page with a working outlet-info + geofence editor.
      **Needs `018_employee_expansion.sql` run in Supabase SQL Editor.**

This closes out Phase 7 (all 6 modules from the reference mockups shipped, adapted to GawEEE's retail
domain). Follow-ons intentionally deferred (noted inline above): auto-posting journal entries from
sales/purchasing, quick-PIN wiring into the POS cashier switcher, real WhatsApp/push notification
delivery.
- [x] Found + fixed a real pre-existing bug while smoke-testing 7.6's new Hak Akses page (which reuses
      `GET /api/admin/users`): PostgREST couldn't resolve the `outlets(name)` embed because two FKs
      exist between `users`/`outlets` (`users.outlet_id` and `outlets.manager_id`), causing every call
      to 500. This silently broke Master Admin → Users the whole time, not just the new page. Fixed via
      explicit FK disambiguation (`outlets!users_outlet_id_fkey(name)`). Verified live via Playwright
      against the demo account: 500 → 200 with correct data.
- [x] Verified all 6 new Phase 7 modules against the live dev server + demo account via Playwright: no
      page crashes (all return 200, no console/page errors) either way — pages whose tables don't exist
      yet (everything except Accounting, which reuses Phase 1 schema) show a graceful empty/error state
      from the API's `handleDatabaseError`, not a broken page, confirming the app stays stable until the
      user runs migrations 013-018.

## Phase 8 — Top Nav Bar (majoo-style module switcher)
User pasted a mockup of majoo's top nav (logo + horizontal pill tabs: Sales/Order Online/Appointment/
Employee/Accounting/Whatsapp/More) and asked specifically for a top bar with Sales, Inventory, Employee,
Accounting, WhatsApp — "moved from the existing menu" (i.e., these 5 sections come out of the flat
sidebar and into the top bar as the primary module switcher).
- [x] Extracted nav data into `lib/nav/config.ts` (`PRIMARY_NAV` = the 5 requested sections,
      `SECONDARY_NAV` = everything else not mentioned — Supplier, Keuangan, Order Online, Booking,
      Master Admin, Pengaturan — plus `findActiveNavItem(pathname)`, a longest-href-match helper so
      e.g. `/dashboard/staff/payroll` resolves to Employee, not the shorter `/dashboard` Sales match).
- [x] New `components/layout/TopNav.tsx`: horizontal pill row for the 5 primary sections + a "More ▾"
      dropdown for the rest, active section highlighted, rendered in `Header.tsx`.
- [x] `Sidebar.tsx` rewritten from a flat always-expanded list into a **contextual** sidebar: shows only
      the active section's children (matching real majoo behavior — confirmed against the earlier
      screenshots, e.g. Employee's sidebar shows Payroll/Hak Akses/Jadwal Kerja/etc). "Kasir (POS)"
      stays pinned above it since it's a standalone mode, not a section.
- [x] Mobile regression avoided: the desktop TopNav pill row is `md:hidden`-excluded from mobile (no
      room for it in the header), so the section-switcher itself (all `PRIMARY_NAV` + `SECONDARY_NAV`)
      was also added into the sidebar drawer, `md:hidden`-gated the other way — visible only below the
      `md` breakpoint, sitting above the contextual children list. Verified both desktop (1440px) and
      mobile (390px) via Playwright screenshots: desktop shows pills + contextual sidebar, mobile drawer
      shows the full switcher + contextual children, no console errors either way.
- [x] "Sales" (top item) merges what were two separate sidebar sections (Dashboard: Ringkasan/Laporan
      Harian, and Penjualan: Transaksi/Invoice) into one, since the reference mockup's "Sales" tab covers
      both the KPI dashboard and transaction list in one section.

## Phase 9 — Sales sidebar: majoo-style nested accordion menu
User pasted 10 screenshots of majoo's full Sales module sidebar (Dashboard/Report/Report Analysis/
Product/Inventory/Customer/Promotion/Commission/Invoice/Campaign, ~60 leaf items, nested accordion
groups) and asked for GawEEE's Sales menu to match. Full plan: `C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`.
Confirmed via direct schema check that several categories (Customer, Promotion, most of Invoice,
Campaign, several report types) describe subsystems GawEEE's schema doesn't have at all — real items
get real pages/APIs, everything else gets an honest `ComingSoon` stub (same pattern as Stocktake/Tax
Report), never a fabricated feature or dead link.
- [x] 9.1 Nav data + accordion sidebar UI — `lib/nav/config.ts`'s Sales item gained a `groups` field
      (9 categories: Report, Report Analysis, Product, Inventory, Customer, Promotion, Commission,
      Invoice, Campaign — 47 leaf items total, matching the mockup's exact order), `Sidebar.tsx` renders
      them as an accordion (one group open at a time, auto-expands to match the current route, adjusted
      during render per React's state-reset guidance rather than an effect to satisfy
      `react-hooks/set-state-in-effect`). Every other section (Employee, Accounting, etc.) keeps the
      flat list — unaffected.
- [x] 9.2 Real report pages, all reusing existing data rather than fabricating anything: Cashier/
      Product/Employee Report (existing `/api/reports/sales-breakdown` cashierSales/bestProducts),
      Inventory Report (new `/api/reports/inventory-report` wrapping `v_inventory_valuation`),
      Settlement Report (new `/api/reports/settlement-report` over `payment_transactions`), Product &
      Sales Peak Time (new `/api/reports/peak-time`, hour/day aggregation), Stock Turnover (new
      `/api/reports/stock-turnover` — COGS sold ÷ *current* stock value as an approximation, clearly
      labeled since the schema has no historical inventory snapshots for a true average).
- [x] 9.3 Customer List — new `customers` table (migration `019_customers.sql`) + CRUD, following the
      exact `SupplierList.tsx` pattern. Starts empty (invoice `customer_name` strings are free-text, not
      a reliable auto-match key). **Needs `019_customers.sql` run in Supabase SQL Editor.**
- [x] 9.4 Commission Group List — dedicated editable view over the existing `staff_members.commission_rate`
      field (Phase 7.3), reuses `GET /api/staff` + `PATCH /api/staff/:id`, no new API surface.
- [x] 9.5 33 `ComingSoon` stub pages for subsystems confirmed (via direct schema check) not to exist:
      Kitchen/Service/Facility/Promo & Loyalty/Deposit/Customer Summary Reports, Customer Satisfaction,
      Department List + 12 more Product items (bundling, recipes, barcode printing, etc.), Customer
      Group/Special Pricing/Custom Fields/Data Setting, Promotion/Coupon/Loyalty/Point Reward, Sales
      Quotation/Order/Delivery List, Send/Buy Marketing Campaign — each honestly labeled with what's
      missing, never a dead link or fabricated data.
- [x] Added the same majoo-style nested accordion to the top-level **Inventory** tab per a follow-up
      mockup: `lib/nav/config.ts`'s Inventory item gained `groups` (Purchase Order (PO), Return, Manage
      Stock, Stock Production, Stock Mutation) plus a new `trailingChildren` field (a flat-link block
      rendered *after* the accordion, for "Supplier List" sitting at the bottom per the mockup — extended
      `Sidebar.tsx`'s `FlatLinks` helper to support this ordering: children → groups → trailingChildren).
      Real reuses: Purchase Order (PO) → existing `/dashboard/suppliers/purchase-orders`, Purchase
      Invoice → existing `/dashboard/suppliers/invoices`, Stock List/Ingredient List →
      `/dashboard/inventory`, Stock Opname → existing `/dashboard/inventory/stocktake`, Supplier List →
      `/dashboard/suppliers`. 13 honest `ComingSoon` stubs for what doesn't exist (Item Request, Purchase
      Delivery, Invoice Payment, Purchase Return + Reconciliation, Stock Waste, Stock Production List +
      Template, and all 5 Stock Mutation items — GawEEE is single-outlet-focused today, no inter-outlet
      transfer workflow exists). Verified live via Playwright: accordion matches the mockup screenshots
      exactly, sampled routes all 200 with no console errors.
- [x] Removed the redundant "Inventory" group from inside the Sales accordion per user follow-up —
      it only ever linked to `/dashboard/inventory`, duplicating the top-level Inventory tab in
      `TopNav`. Sales sidebar is now 8 groups (Report, Report Analysis, Product, Customer, Promotion,
      Commission, Invoice, Campaign); Inventory access stays solely via its own top tab.
- [x] Verified live via Playwright against the demo account: accordion expand/auto-open matches the
      mockup exactly (screenshotted both collapsed and Product-expanded states), all 11 sampled real +
      stub routes return 200 with no console errors except the expected 500 from `customers` (table not
      yet migrated), and Sales Peak Time renders a real hour-by-hour bar chart from actual demo
      transaction data (peak 12:00-13:00, confirming the aggregation logic is correct).

## Phase 10 — Build real functionality behind every ComingSoon stub (where it fits the business)
User asked to sweep the whole system and complete every "belum tersedia" feature. Full plan + the
explicit Tier A/B/C disposition of all 50 stubs (which get built for real vs. stay honest stubs and
why): `C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`. Tier C (Kitchen/Service/Facility Report,
Ojek Online pricing, Time-Based Pricing, Customer Satisfaction, Deposits, Notes Category List, Sales
Quotation/Order/Delivery, Buy Marketing Campaign) stays stubbed — confirmed these don't fit GawEEE's
retail/bakery/frozen-food/minimarket business model, building them would be fabricated functionality.
- [x] 10.1 Stocktake — full physical count session workflow: `submit_stocktake()` atomic function
      (migration `020_stocktake_functions.sql`) applies every counted-vs-expected variance via
      `update_inventory()` and marks the session completed, all-or-nothing. Start session (snapshots
      expected qty from `inventory`) → enter counts → submit.
- [x] 10.2 Invoice Supplier + Invoice Payment — real CRUD over the existing `purchase_invoices`/
      `purchase_payments` tables (Phase 1, unused since): record an invoice against a received PO,
      record payments against it (auto-updates unpaid/partial/paid). Combined into one page — payment
      recording is inline per-invoice rather than a separate page (todo'd redirect note left at
      `/dashboard/inventory/purchasing/invoice-payment` pointing here).
- [x] 10.3 Payment Methods Settings — new `outlets.enabled_payment_methods` column (migration
      `021_payment_methods_settings.sql`), settings page to toggle cash/e-wallet/bank-transfer per
      outlet, and POS's `PaymentMethod.tsx` now actually fetches and respects it (previously hardcoded).
- [x] 10.4 Tax Report — real PPN report from `invoices.tax_amount` (already computed by `create_invoice()`
      at sale time, just never had a report view), grouped by month.
- [x] 10.5 Stock Waste — reuses `update_inventory()` with `movement_type='waste'` (no new table needed,
      the function already takes an arbitrary movement type string), write-off form + history list.
- [x] 10.6 Purchase Return — new `purchase_returns`/`purchase_return_items` tables + atomic
      `submit_purchase_return()` (migration `022_purchasing_extensions.sql`), draft → line items → submit
      (decrements inventory via `update_inventory()`).
- [x] 10.7 Item Request — new `item_requests` table, staff request a restock, manager approves/rejects,
      "converted" flag marked manually once a real PO is created for it (no auto-PO-generation, keeps
      the existing PO creation flow as the single source of truth).
- [x] 10.8 Stock Mutation — new `stock_transfers`/`stock_transfer_items` tables + atomic
      `ship_stock_transfer()`/`receive_stock_transfer()` functions (migration `023_stock_transfers.sql`).
      One workflow (request → ship → receive) covers all 5 mockup menu items as status/role-filtered
      views of the same data (`StockTransferManager` component, `view` prop). Needed a new same-company
      outlets SELECT RLS policy (`outlets_select_same_company`) since the original policy only let a
      non-master_admin see their own outlet — transfers need sibling outlet names for the picker.
- [x] 10.9 Print Barcode — real scannable CODE128 labels. Added the `jsbarcode` dependency rather than
      hand-rolling barcode encoding tables from memory with no way to verify correctness against a real
      scanner — client-side only, browser print, no backend needed.
- [x] 10.10 Customer Group — new `customer_groups` table + `customers.group_id` (migration
      `024_customer_groups.sql`), also lays the groundwork Special Pricing Group needs.
- [x] 10.13 Special Pricing Group — new `special_prices` table (group + product → override price,
      migration `025_special_pricing_custom_fields.sql`).
- [x] 10.14 Customer Custom Fields — staff define field labels (`customer_field_definitions`), values
      stored in a new `customers.custom_fields` jsonb column; the Customer List create form renders them
      dynamically. Scoped down from a full form-builder per the plan — just label + text value.
- [x] 10.11 Promotion + Coupon — new `promotions`/`coupons` tables (migration `026_promotions_loyalty.sql`),
      manager creates/toggles promotions, staff redeem coupon codes (`/api/coupons/redeem` validates
      active/not-expired/under-limit and increments usage atomically-adjacent). Manual apply at checkout
      per the plan's scope line — no automatic discount-rules engine.
- [x] 10.12 Loyalty + Point Reward — new `loyalty_ledger` table + 2 settings columns on `outlets`
      (points earned per Rp1,000, Rupiah value per point redeemed). One system (earn + redeem is a
      single ledger), so both mockup menu items render the same `LoyaltyManager` component rather than
      being built as two half-duplicated features.
- [x] 10.15 Send Marketing Campaign — reuses `whatsapp_broadcasts` (added a nullable `customer_group_id`
      column, migration `027_campaign_targeting.sql`) rather than a new table; real audience count when
      targeted at a group (customers in that group with a phone on file).
- [x] 10.16 Stock Production + Master Recipes — new `recipes`/`recipe_ingredients`/`production_runs`
      tables + atomic `submit_production_run()` (migration `028_stock_production.sql`, consumes
      ingredient stock and adds finished-good stock in one transaction, same guarantee as
      `create_invoice()`). "Master Recipes" and "Stock Production Template" are the same concept (a
      template *is* a recipe) so both mockup menu items render the same `RecipeManager` component.

**Phase 10 complete** — all 16 real-functionality items shipped across 9 commits, verified live via
Playwright after every batch (no console/page errors, sampled routes all 200), `tsc`/`eslint`/
`npm run build`/`npm test` green throughout. 9 new migrations this phase (`020`-`028`), all appended to
`database/combined_migration.sql` — **all 9 need to be run in Supabase SQL Editor** for the features to
work against the live database (see the migration filenames referenced in each item above for the exact
list and order).
- [x] Post-migration deep verification (after the user ran all 9): sampled all 16 new GET endpoints
      (200 across the board), then actually *called* the riskiest atomic RPCs end-to-end
      (submit_stocktake, submit_purchase_return, ship/receive_stock_transfer, submit_production_run) —
      not just page-loads. Found and fixed two real bugs this surfaced:
      1. **5 new components read the wrong JSON key from `GET /api/products`** (`.products` instead of
         the route's actual `.data`) — RecipeManager, SpecialPricingManager, PrintBarcodeManager,
         StockTransferManager, PurchaseReturnManager. Their product pickers were silently always empty;
         page loads never surfaced it since there's no error, just no options. Caught only by actually
         reading the fetched array's contents during the write test, not by loading the page.
      2. **`submit_production_run()` failed on every call** with "column reference \"output_quantity\"
         is ambiguous" — `returns table (output_quantity int)` implicitly declares a plpgsql variable
         named `output_quantity`, which collided with `recipes.output_quantity` in a `select ... into`
         inside the function body. Fixed by renaming the return column to `produced_quantity`
         (migration `029_fix_production_run.sql` — **needs to be run** in addition to the other 9).
         create_recipe/create_production_run both succeeded silently; only the final /submit call
         exposed it, confirming the value of testing the full flow through to completion, not just the
         first step. Test artifacts (recipe/run/transfer/return) cleaned up via service-role delete
         after confirming the bug.

## Phase 11 — Retail-completeness gaps for a real Alfamart/Indomaret/sembako-agent/frozen-food operation
User asked for an honest assessment of what's missing to be a genuinely complete retail system (not just
mockup-matching) for their target verticals. Investigated the actual code and confirmed 12 real gaps;
user approved building all of them. Full plan (including why each does/doesn't touch the core
`create_invoice()`/`void_invoice()` functions): `C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`.
- [x] 11.1 Thermal Receipt — `@media print` block in `app/globals.css` isolates `#receipt-print-area`
      (58mm width, monospace) so "Cetak Struk" prints only the receipt, sized for a thermal printer,
      not the whole POS page. CSS only, no logic changes.
- [x] 11.2 Cashier Shift Management — `cashier_shifts` (Phase 1, unused) had `closing_cash not null`,
      which didn't support "open now, close later." Migration `030_cashier_shifts_open_close.sql` makes
      it nullable + adds `status`/`opened_by`. Open/close API computes `total_transactions` from cash
      `payment_transactions` in the shift's time range; the generated `cash_variance` column recomputes
      automatically. POS gets a soft banner (not a hard gate — see plan) linking to a full history page.
      **Needs `030_cashier_shifts_open_close.sql` run in Supabase SQL Editor** before it works live.
- [x] 11.3 Notification Center — `system_alerts` table existed (demo-seeder only) with zero API/UI.
      New `GET /api/notifications` aggregates it + `v_low_stock_alerts` + pending item-request/expense-
      request/PO-approval counts at read time (no write-path changes anywhere else). Bell icon +
      dropdown in `Header.tsx`. **Already verified live** — works against existing tables, no migration
      needed for this one; returned real low-stock alert data on first test.
- [x] 11.4 CSV Export — new `lib/utils/exportCsv.ts` + `ExportCsvButton`, wired into 7 pages: Cashier/
      Product/Employee/Inventory/Tax Report, Invoice list, Purchase Order list.
- [x] 11.5 Hold/Park Transactions at POS — new `held_transactions` table (migration `031`), API
      (`app/api/held-transactions/`), `HeldTransactionsPanel` on the POS screen ("Tahan Transaksi" /
      "Transaksi Tertahan (N)"). Restores items + discount into the Zustand store on resume, then
      deletes the held row. **Bonus fix**: while testing this live, found the demo seeder had never
      wiped `recipes`/`production_runs`/`item_requests`/`purchase_returns`/`special_prices`/
      `stock_transfers`/`stocktakes` — all of which FK to `products.id` — so any demo tenant that ever
      had a stocktake/recipe/etc. done against it would permanently fail to reseed (silently, since the
      delete's error wasn't checked). Fixed in `app/api/demo/seed/route.ts`: added all of them to the
      wipe list in FK-safe order, and now throws loudly if the `products` delete itself fails. Verified
      live: demo login + add-to-cart + hold flow all confirmed working; the hold itself 500s with
      "Could not find the table 'public.held_transactions'" until migration 031 is run (same expected
      state as 11.2 pending migration 030).
- [x] 11.6 Product Bundling — new `product_bundles`/`product_bundle_items` tables (migration `032`),
      management UI at `/dashboard/sales/product/bundling` (replaced the old `ComingSoon` stub), and a
      `BundleQuickAdd` "Tambah Paket" action on the POS screen that adds every component to the cart and
      folds the bundle-vs-components price gap into the existing invoice-level `discount_amount`/
      `discount_reason` fields (additive to any manual discount already applied) — `create_invoice()`
      untouched. Verified live via a real POST through the app's own API + POS quick-add; blocked only
      on migration 032 (same expected pending-migration state as 11.2/11.5).
- [x] 11.7 QRIS dynamic QR code rendering — new `QrCodeCanvas` (using the `qrcode` npm library, same
      reasoning as `jsbarcode`) renders the mock `qr_code_data` string from `/api/payments/initiate`
      as an actual QR image in the POS e-wallet step, replacing the static placeholder div. Still
      demo/mock data, now actually visible. Verified live: real QR canvas renders with non-blank pixel
      data during an e-wallet checkout.
- [x] 11.8 Customer Refund (distinct from supplier Purchase Return) — new `customer_refunds`/
      `customer_refund_items` tables + atomic `submit_customer_refund()` (migration `033`), mirroring
      `submit_purchase_return()`'s draft→completed pattern; restocks via `update_inventory()`, doesn't
      touch `invoices`/`payment_transactions`/`void_invoice()`. UI added to the invoice detail page
      (`InvoiceDetail.tsx`): a per-item refund-quantity form capped at (purchased − already refunded),
      manager+ gated same as void. **Bonus fix**: `GET /api/invoices/[id]` never joined product names,
      so the item list showed raw product IDs — now embeds `products(name)`. Verified live: item names
      render correctly, refund form found and submitted on a real paid/non-voided invoice, correctly
      blocked on pending migration 033 (same expected state as 11.2/11.5/11.6).
- [x] 11.9 Split Payment at checkout — `POST /api/payments/initiate` now accepts `payments: [{method,
      amount}, ...]` (one `payment_transactions` row per line) instead of a single method; scoped down
      to at most 1 non-cash line per checkout (each pending digital method needs its own confirmation
      screen, so 2+ simultaneous pending methods isn't worth the UI complexity — enforced both
      client-side, via the dropdown, and server-side). New `SplitPaymentEditor` on the POS screen shows
      a running "Sisa Bayar" as lines are added; `create_invoice()` untouched. No migration needed.
      **Verified live** (highest-risk item in Phase 11 — touches the checkout flow directly): plain cash
      sale and plain e-wallet sale both still work unchanged (regression check), plus 2 new split
      scenarios — cash+e-wallet (routes to the existing e-wallet confirm screen for the pending line)
      and cash+cash (skips straight to the receipt since nothing is pending).
- [x] 11.10 Multi-UOM / Satuan Ganda (sell by box vs piece) — new `product_units` table + 2 nullable
      cosmetic columns on `invoice_items` (migration `034`). A bulk-unit add converts to an ordinary
      base-unit quantity plus a per-item `discount` — `create_invoice()` already supported per-item
      discount (`p_items: [{product_id, quantity, discount?}]`, confirmed by reading the function), so
      genuinely zero SQL changes. `CartItem` gained optional `discount`/`unit_label`/`unit_quantity`
      fields; `addItem`'s merge logic now overwrites price/label fields from the newest add instead of
      keeping the first-added line's stale values (an incidental correctness fix for the non-multi-UOM
      case too). New `UnitPickerModal` in the POS product grid (barcode scans still resolve to the base
      unit only — scoped deliberately, no per-unit barcodes modeled), a "Kelola" expandable row in the
      product list for adding/removing units, and `sold_unit_label` shown on the cart/receipt. Verified
      live: management UI renders/expands correctly and the base unit displays right; the actual
      create/use round-trip is blocked on migration 034 (`GET`/`POST /api/product-units` both correctly
      500 "table not found" — same expected state as every other Phase 11 item needing a new table).
- [x] 11.11 Expiry/Batch Tracking at PO receiving + Expiry Report (scoped down from full FEFO — see
      plan) — `update_inventory()` gains 2 optional trailing params (`p_batch_number`, `p_expiry_date`,
      migration `035`), purely additive so every existing caller (create_invoice, void_invoice, stock
      transfers, production, returns) is unaffected. PO receiving (`PurchaseOrderList.tsx`) now prompts
      for batch number + expiry date per line (optional, same `window.prompt` style already used there
      for quantity). New Expiry Report at `/dashboard/inventory/expiry` (added under Inventory > Manage
      Stock) lists received batches with an expiry date, soonest-first, color-coded
      Aman/`N hari lagi`/Kadaluarsa. Notification Center gets an `expiringSoonCount` (batches expiring
      within 7 days, works today — reads pre-existing columns, no migration needed for this part).
      Explicitly NOT full FEFO: no per-batch remaining-quantity tracking, no auto-deduction at sale
      time. Verified live: Expiry Report page and nav link both work today; the actual batch-capture
      write is blocked on migration 035 (same expected pending-migration state as every new-table item).
- [x] 11.12 Petty Cash / Expense Ledger — extends `expense_requests` (Phase 10) with `paid_at`/
      `payment_method` (migration `036`) rather than a new system. A "Bayar Tunai"/"Bayar Transfer"
      action on an approved request in `FinanceApprovals.tsx` marks it paid and, best-effort, posts a
      balanced journal entry via the existing `create_journal_entry()`/`post_journal_entry()` (additive
      calls, no function changes) debiting Beban Operasional (5200) / crediting Kas (1000) or Bank
      (1010) — both already in every outlet's default chart of accounts. New Petty Cash report at
      `/dashboard/accounting/petty-cash` (added under Accounting nav) shows a running "Total Kas Keluar"
      + CSV export. Verified live end-to-end for create→approve (both work today, no migration needed);
      the pay step itself correctly 500s "Could not find the 'paid_at' column" — same expected
      pending-migration state as every other Phase 11 item needing new columns/tables.

  **Phase 11 complete — all 12 items shipped and verified live** after the user ran migrations 030-036.
  - [x] **037 critical fix**: post-migration live testing found migration 035 had broken ordinary
        checkout — `create or replace function update_inventory(...)` with 2 *added* parameters doesn't
        replace the old 9-param function in Postgres, it creates a second overload, so every call
        without the new params became ambiguous ("function update_inventory(...) is not unique"). This
        broke `create_invoice()`/`void_invoice()`/every inventory-touching path, not just the new Expiry
        feature. Fixed by dropping the old overload explicitly. **User ran migration 037** and a live
        cash sale was re-verified working (201, not 500).
  - Full live re-verification after 037, all confirmed genuinely working end-to-end (not just
    "doesn't 500"): 11.5 hold→resume round trip, 11.6 bundle create + POS quick-add with discount, 11.7
    QR canvas renders real pixel data, 11.8 refund submit + restock, 11.9 cash+e-wallet split completing
    a real sale, 11.10 unit create → POS picker → discounted checkout → receipt shows "1 Dus", 11.11 PO
    receive with batch/expiry prompts → Expiry Report shows the batch correctly, 11.12 mark-paid →
    journal posted → Petty Cash report shows the running total.

## Phase 12 — Best-in-class Cashier Portal + public POS demo
User pivoted focus to the POS/cashier experience itself: redesign it to be visually striking/colorful/
chart-rich (not the prior flat blue-and-gray screen), add cashier-support menus that don't exist yet
(Absensi self-service, Riwayat Kasir, Laporan Harian, Checklist Activity, Pengajuan Izin/Sakit/Libur),
a receipt reprint capability, and a new public "Coba DEMO POS System Instan" landing-page entry point.
Full plan (architecture decisions, DB design, batch order):
`C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`.

- [x] **A — Visual foundation (zero new DB)**: rewrote `app/pos/layout.tsx` into a colorful persistent
      shell (navy gradient header, cashier identity, `PosPortalNav` tab bar for the 6 portal sections —
      the other 5 are stub routes not yet built, see Batch B/C). Redesigned `POSScreen.tsx` (category-
      colored product tiles via new `lib/utils/chartColors.ts` — same `--chart-1..8` slots
      `CategoryBreakdownChart` uses —, richer cart summary with a gradient total box, quick-cash amount
      buttons on the cash screen, a celebratory gradient success screen), `ProductSearch.tsx`,
      `ShoppingCart.tsx`, `PaymentMethod.tsx` (icons + brand tokens), `Receipt.tsx` (removed the
      redundant "PEMBAYARAN BERHASIL" header now that POSScreen's success card has its own). All on
      the existing `--brand-*`/`--status-*` design tokens (`app/globals.css`), not a new palette.
      Verified live via screenshots through a full cash-sale flow — cart, cash entry w/ quick amounts,
      success/receipt all render correctly and function identically to before visually restyled.
- [x] **B — Self-scoped read features (zero new DB)**: `GET /api/invoices` gained a `cashier_id=me`
      filter (resolves server-side to `auth.authUserId`, matching what `create_invoice()` writes) — used
      by new **Riwayat Kasir** (`/pos/riwayat`, `CashierHistory.tsx`): today's total/count stat cards +
      a full transaction table with status badges, click "Cetak Ulang" to reprint via a generalized
      `Receipt.tsx` (now takes a `ReceiptItem[]` shape satisfied by both live cart state and fetched
      `invoice_items`). New **Laporan Harian Saya** (`/pos/laporan`, `MyDailyReport.tsx`) via new
      `GET /api/pos/my-daily-report?date=` (cashier + date scoped, existing outlet-wide
      `/api/invoices/daily-summary` untouched): stat cards + a new `SalesByHourChart` (recharts, same
      token conventions as `SalesTrendChart`) + reused `CategoryBreakdownChart` for payment-method
      breakdown. Verified live with real screenshots: empty-state correctly shows Rp 0 for a day with no
      sales yet, and a date with real data renders correct totals + real bar charts.
- [x] **C — New HR-lite tables (migrations 038-040 pending — not yet run by the user)**:
  - Migration `038`: nullable `staff_members.user_id` link (+ best-effort email backfill), so a login
    can resolve "my staff row." New `GET /api/attendance/me` (resolves the link, returns today's status
    + 7-day history) + `SelfAttendance.tsx` at `/pos/absensi` — reuses the *existing*
    `POST /api/attendance/clock-in|clock-out` unchanged, gracefully shows "belum ditautkan" if no
    staff_members row is linked yet.
  - Migration `039`: `leave_requests` table, mirrors `expense_requests` exactly (keyed to `users(id)`,
    same pending/approved/rejected shape). `GET/POST /api/leave-requests` (+ new `requested_by=me`
    filter, same convention as invoices' `cashier_id=me`) and `POST /api/leave-requests/[id]/decide`.
    Self-service submit form at `/pos/izin` (`LeaveRequestForm.tsx`) + manager decide view at
    `/dashboard/staff/approvals/leave` (`LeaveApprovals.tsx`, added to the Employee > Approvals nav).
  - Migration `040`: `checklist_items` (manager-defined opening/closing duties) +
    `checklist_completions` (who ticked what, when — deleting un-ticks). `ChecklistActivity.tsx` at
    `/pos/checklist`: today's items as checkboxes with who/when completed, plus a manager-only inline
    "Kelola Checklist" editor (same expandable pattern as `ProductUnitsEditor`).
  - Verified live: all 3 new `/pos/*` pages load and render correctly (empty states, not crashes) ahead
    of their migrations — same expected pending-migration behavior established throughout Phase 11.
- [x] **D — Demo entry point**: `POST /api/demo/seed` now accepts an optional `{role: 'cashier'}` body —
      finds-or-creates a second `users` row (`kasir-demo@gaweee.app`, fixed in `lib/demo/catalog.ts`)
      role='cashier' on the SAME demo outlet, plus a linked `staff_members` row (`user_id` set, so
      Absensi works once migration 038 lands), reusing the admin's already-seeded 90-day history rather
      than duplicating it. Existing admin `TryDemoButton` unchanged/untouched (still posts no body).
      New `TryPosDemoButton.tsx` (distinct green-gradient styling) posts `{role:'cashier'}` and redirects
      to `/pos` instead of `/dashboard`, placed on the landing page hero right below the existing demo
      button as a clearly labeled second option: "🛒 Coba DEMO POS System Instan (Sudah Terisi Data)".
      **Verified live end-to-end**: landing click → cashier login → lands on `/pos` showing "Kasir Demo"
      → all 6 portal tabs (Kasir, Riwayat Kasir, Laporan Harian, Absensi, Checklist, Izin) click through
      without crashing.

  **Phase 12 complete — all 4 batches shipped and fully live-verified** after the user ran migrations
  038-040: Absensi self-service clock-in confirmed via direct network trace (`staff` correctly resolved
  via the `user_id` link, `POST /api/attendance/clock-in` → 201 → reload shows it), Izin submit shows up
  immediately in "Riwayat Pengajuan Saya", Checklist confirmed both ends — a manager (`master_admin`
  demo login) can add/remove items via "Kelola Checklist", and ticking one off correctly records
  who/when ("oleh Demo Owner · HH:MM"). Also confirmed the cashier demo login correctly does NOT see
  "Kelola Checklist" (manager-gated as designed) — test item cleaned up afterward.

## Phase 12b — Kasir screen matched to user-provided mockup + catalog expansion
User attached 3 screenshots of a mockup (from a sibling GawEEE app's own "Mode Kasir") and asked for the
Kasir screen's placement/visual to match it, filled with a genuinely complete frozen-food catalog.
Adopted the green theme + layout, not a new architecture — same `/pos/*` portal from Phase 12.

- [x] Green re-theme: `app/pos/layout.tsx` header now has "GawEEE.com" + "Mode Kasir" badge + "Menu
      Lengkap" link + avatar on a green gradient bar; `PosPortalNav` restyled as pill tabs (active =
      filled emerald) on a white bar; added a 7th tab, **Daftar Harga** (`/pos/harga`,
      `PriceList.tsx`) — full catalog grouped by category with CSV export, reusing the existing
      `/api/inventory/[outletId]` endpoint.
- [x] `KasirStatsHeader.tsx`: 4 colored stat cards (Omzet Hari Ini/Transaksi/Rata-rata/Menunggu
      Pembayaran) + `SalesByHourChart` + new `PaymentMethodDonutChart` (recharts, same `--chart-1..8`
      token convention) rendered directly on the Kasir screen itself, reusing
      `/api/pos/my-daily-report` (extended with a `pending_count` field for the 4th card).
- [x] `ProductSearch.tsx`: category filter tabs above the grid; product tiles restyled with a colored
      top-border strip (was a full colored border) to match the mockup.
- [x] `CustomerPicker.tsx` (new): search existing customers (`GET /api/customers?search=`) or
      quick-create with just name+phone (`POST /api/customers`, already supported it), wired into
      checkout's `customer_name`/`customer_phone`.
- [x] Coupon/promo code input wired to the **already-existing** `POST /api/coupons/redeem` (built in an
      earlier phase, never had a UI) — computes the discount client-side from `discount_type`/
      `discount_value` and applies it via the store's `setDiscount`.
- [x] "Bayar Sekarang / Bayar Nanti" toggle: pay-later adds `'pay_later'` to `createInvoiceSchema`'s
      payment_method enum (→ `create_invoice()` already maps any non-`'cash'` method to
      `payment_status='pending'`, zero SQL changes) and skips `/api/payments/initiate` entirely, landing
      on a new amber "Menunggu Pembayaran" receipt variant instead of the green success screen.
- [x] **Real pre-existing bug fixed while wiring the coupon feature**: `discountAmount`/`discountReason`
      (used by Product Bundling's "hemat Rp X") were tracked in `posStore` and shown in the cart, but
      `handleCheckout` never actually sent `discount_amount`/`discount_reason` in the `POST /api/invoices`
      body — so a bundle discount displayed in the cart was **never actually applied** to the charged
      total. Now included in every checkout call.
- [x] `lib/demo/catalog.ts` expanded from 24 to 64 products across 8 categories (added Bumbu & Pelengkap
      Beku, Camilan & Snack Beku) — kept the 2 intentionally-lean-stock items unchanged by name so the
      low-stock-alert demo path still works.
- Verified live end-to-end (forced a full reseed via service-role invoice wipe to pick up the new
  catalog): stat cards/charts render with real data, category tabs filter correctly, customer
  quick-create + select confirmed via network trace, coupon apply confirmed exact math (10% off:
  Rp 41.800 → Rp 37.620), Bayar Nanti confirmed creating a `payment_status='pending'` invoice and the
  Menunggu Pembayaran stat correctly incrementing.

## Phase 13 — Fill in the remaining 24 ComingSoon menu items
Audit found 24 stub pages under Sales/Inventory. User asked to fill in all of them, including the 12 that
an earlier session had deliberately left as business-model exclusions ("Tetap bangun semuanya" — expands
GawEEE beyond pure retail into F&B/services/facility-booking too). Full plan (schema for each item, why
each does/doesn't touch `create_invoice()`, batch order):
`C:\Users\LENOVO\.claude\plans\nifty-tumbling-candy.md`.

- [x] **A — Product/category structure**: 1. Department List, 2. Notes Category List, 3. Extra Product
      (modifiers). Migrations 041-043 run by user; live-verified end-to-end via Playwright against the
      demo account — department creation + category assignment, note preset creation + POS "+ Catatan"
      attachment + receipt display, and modifier groups (priced option -> its own cart line, unpriced
      option -> note on the base line) all confirmed working through a real checkout.
- [x] **B — Customer-adjacent**: 4. Customer Data Setting, 5. Customer Summary Report, 6. Customer
      Satisfaction. Migrations 044-045 run; live-verified end-to-end via Playwright — require-phone +
      default-group settings persist and are honored by CustomerList's create form, custom field
      required-toggle/delete persist, a logged review updates the avg-rating/distribution chart and
      deletes cleanly, and the summary report renders.
      - Item 4 turned out to overlap heavily with the already-built "Customer Custom Fields" page
        (`CustomerFieldDefinitionManager` + `custom_fields` jsonb wiring into `CustomerList` already
        existed, contrary to the plan's assumption it was UI-less). Kept both nav items distinct:
        Custom Fields = per-customer data schema (also gained is_required + delete this batch); Data
        Setting = new outlet-wide module toggles (`customer_module_settings`: require phone at
        checkout, default walk-in group), both now wired live into `CustomerList`'s create form.
- [x] **C — Pricing**: 7. Price Scheduler, 8. Time-Based Pricing, 9. Ojek Online Price List.
      Migrations 046-047 run; live-verified end-to-end via Playwright — a same-day schedule applies on
      page-open and updates `products.selling_price`, an active time window shows the promo badge and
      correctly discounted price in the POS cart AND survives through a real cash checkout (receipt
      total matched exactly), and the ojol reference list saves/lists correctly.
      - **Real bug found and fixed while verifying**: `product_modifier_options.linked_product_id` had
        no `ON DELETE` action, so once any modifier option linked to a real product, that product could
        never be deleted — broke the demo reseed route entirely. Fixed via migration
        `047_fix_modifier_option_fk.sql` (`ON DELETE SET NULL`).
      - **Real bug found and fixed while verifying**: my initial Time-Based Pricing implementation kept
        `unit_price` at the catalog price and only passed a separate `discount` field — but
        `posStore`'s client-side `subtotal()`/`total()` never subtracts per-item `discount` (only
        Multi-UOM worked because it bakes the discount directly into `unit_price`). Fixed
        `ProductSearch.tsx`'s `handleAdd` to set `unit_price` to the already-discounted price, matching
        the established Multi-UOM pattern, so the cashier-facing total always matches what
        `create_invoice()` actually charges.
- [x] **D — Deposits**: 10. Product Deposits, 11. Deposit Report. Migration 048 run; live-verified
      end-to-end via Playwright — deposit creation with auto-filled total, marking
      fulfilled/cancelled, and the report's KPIs/donut chart/list all confirmed working. Fulfilling a
      deposit is a manual status change, not an automatic invoice — the real sale still goes through
      the normal POS at pickup, same scoping as Bookings.
- [x] **E — Service Products + Kitchen**: 12. Service Products, 13. Service Report, 14. Kitchen Report.
      Migrations 049-050 run; live-verified end-to-end via Playwright, including the required full
      checkout regression pass (cash/e-wallet/split payment for normal goods — all confirmed correct,
      including stock deduction and void-restores-stock) plus the new service flow (creation with no
      inventory row, POS "Layanan" tab always-available tile, cash checkout, Kitchen kanban
      Menunggu→Diproses→Siap, Service Report, and voiding a service invoice with no stock side effects).
      Two real bugs found and fixed during this verification:
      - `product_deposits.product_id` had no `ON DELETE` action (same class as the Batch C modifier bug)
        — broke the demo reseed route again. Fixed via `050_fix_product_deposits_fk.sql`.
      - **Pre-existing bug, unrelated to Batch E**: `posStore.addItem`'s merge reducer computed
        `unit_quantity: sameUnit ? (i.unit_quantity ?? 0) + (item.unit_quantity ?? 0) : item.unit_quantity`
        — tapping the same *plain* (non-bulk-unit) product tile twice merges two `undefined` unit_quantity
        values as `0 + 0 = 0`, which then fails `invoiceItemSchema`'s `.positive()` check at checkout,
        blocking a completely ordinary "add 2 of the same item" cashier action. Fixed in `store/posStore.ts`
        to only sum when a real bulk unit is involved.
- [x] **F — Facility/Booking**: 15. Product Facility, 16. Facility Report. Migration 051 run;
      live-verified end-to-end via Playwright — facility creation, booking linked to a facility, status
      flow through to Completed, and Facility Report's counts/chart all confirmed working. Extends the
      existing Bookings module with a `facilities` table + nullable `bookings.facility_id`, rather than
      a separate booking system.
      - **Real pre-existing bug found and fixed**: `BookingsManager`'s create form always sent
        `scheduled_end_time` as `''` when left blank (a legitimately optional field) — Zod's
        `.optional()` accepts an empty string as valid, but Postgres rejects `''` for a `time` column,
        so creating ANY booking without an end time has always 500'd. Fixed client-side to omit the
        field entirely when blank, matching the `staff_id`/`facility_id` pattern already used nearby.
- [x] **G — Sales document workflow**: 17. Sales Quotation List, 18. Sales Order List, 19. Sales
      Delivery List. Migration 052 run; live-verified end-to-end via Playwright — quotation
      draft→sent→accepted→Convert to Invoice, order-from-quotation→confirmed→Fulfill→invoice, and
      delivery preparing→shipped→delivered all confirmed working. New `sales_quotations`/
      `sales_quotation_items` and `sales_orders`/`sales_order_items` tables mirror `purchase_orders`'
      header+line-items shape (unlike `purchase_orders` itself, these DO get proper RLS, consistent
      with every other table added this phase). "Convert to Invoice" (quotations) and "Fulfill"
      (orders) both call `create_invoice()` directly, honoring the quoted/ordered price via the
      existing per-item discount mechanism (current catalog price minus quoted price) — zero
      `create_invoice()` changes. Sales Delivery is a manual courier-tracking log against any invoice,
      no courier API (disclosed in the UI).
- [x] **H — New-aggregation reports**: 20. Promo & Loyalty Report, 21. Purchase Return Reconciliation.
      Migration 053 run; live-verified end-to-end via Playwright, including a real reconciliation math
      check (demo data had zero purchase invoices, so the test seeds one via the API, links a completed
      return to it, and confirms the report's "returned" amount reflects it). No new core tables for
      item 20 (pure aggregation over
      existing coupons/loyalty_ledger/promotions, honestly disclosing that promotions have no usage
      tracking). Item 21 adds one nullable `purchase_returns.purchase_invoice_id` column, wired into the
      existing Purchase Return creation form as an optional "Kaitkan ke Invoice" dropdown.
- [x] **I — Marketing budget tracker**: 22. Buy Marketing Campaign. Migration 054 run; live-verified
      end-to-end via Playwright — create→approve→mark completed and create→reject both confirmed
      working. Mirrors `expense_requests`' exact submit/approve/reject shape (new
      `campaign_requests` table), plus a "Tandai Selesai" action once approved. Explicitly labeled in
      the UI as an internal budget tracker — not connected to any ad-platform API.
- [x] **J — Recipe change scheduling**: 23. Scheduling Recipe Changes. Migration 055 run; live-verified
      end-to-end via Playwright — scheduling an ingredient change for today applies automatically on next
      page open and `recipe_ingredients` is confirmed replaced via the API. Same check-on-page-load apply
      pattern as Price Scheduler (item 7). Verification also turned up and fixed three real bugs found
      along the way, unrelated to the new feature itself but blocking it: (1) `GET /api/recipes` was
      silently returning an empty list due to a stale/incorrect PostgREST FK embed hint
      (`products!recipes_output_product_id_fkey(name)` → simplified to `products(name)`); (2) the demo
      seed route's background reseed had no concurrency guard, so rapid repeated `/api/demo/seed` calls
      could race two `regenerateDemoData()` runs against each other and leave orphaned rows — fixed with
      a module-level in-flight-promise guard so concurrent calls share one run; (3) migration 052's
      `sales_quotation_items.product_id`/`sales_order_items.product_id`/`sales_quotations.invoice_id`/
      `sales_orders.invoice_id` FKs had no `ON DELETE` action (same bug class as migrations 047/050),
      blocking product/invoice deletion during reseed — fixed via new migration 056 (`on delete cascade`
      for the product_id columns, `on delete set null` for the nullable invoice_id columns). The seed
      route's wipe sequence was also missing cleanup steps for Batch G's sales-document tables, now added,
      plus a defensive company-scoped safety-net cleanup since the demo tenant has more than one outlet.
      **Migration 056 needs to be run in Supabase SQL Editor.**
- [x] **K — Trivial fix**: 24. Purchase Delivery (redirect to existing PO page, no new feature). Done
      and live-verified — no migration needed, confirmed redirecting to Purchase Order correctly.

**Phase 13 complete: all 24 items across Batches A-K built and live-verified.**

## Phase 15 — Fill every menu with realistic 2-month demo data
Most Phase 13 menus had zero demo data (or a handful of leftover one-off rows from live-verifying them,
not real history), so opening them showed an empty state even though the feature worked. Extended
`regenerateDemoData()` (`app/api/demo/seed/route.ts`) to also generate ~60 days of realistic data for
every one of them, wiping and reseeding on every reset the same way the core POS/inventory/purchasing
loop already did. Also fixed `invoices.customer_phone` (previously always `null`) to carry a real number
matching `customer_name`, so Customer Summary Report's phone-based matching (no FK exists, disclosed
in that report) actually has something to match against.
- [x] Created real `customers` rows (10, matching the existing `DEMO_CUSTOMER_NAMES`), `product_departments`
      (3, with 2 categories grouped under one), `note_presets` (6), `product_modifier_groups`/`options`
      (spice-level + a priced add-on on 2 products), `customer_field_definitions` (2),
      `customer_reviews` (20), `price_schedules` (2 already-applied + 2 pending), `time_based_prices` (2),
      `channel_prices` (45, first 15 products × 3 channels), `product_deposits` (15, all 3 statuses),
      `facilities` (3) + `bookings` (20), `sales_quotations`/`items` (15, some converted to a real
      invoice) + `sales_orders`/`items` (10) + `sales_deliveries` (8), `purchase_returns`/`items` (6,
      linked to a real `purchase_invoice_id` for reconciliation), `recipes`/`recipe_ingredients` (3) +
      `recipe_change_schedules` (1 applied + 1 pending), `coupons` (5) + `loyalty_ledger` (34),
      `stock_transfers`/`items` (5, between the demo tenant's two outlets), `stocktakes`/`details` (3,
      across draft/in_progress/completed/approved with a couple of deliberate variances), and expanded
      `campaign_requests`/`expense_requests`/`online_orders` from a handful of leftover test rows to 10-20
      properly backdated ones each.
- [x] Live-verified every one of the 29 corresponding menu pages renders this data correctly (not just
      that the rows exist) — Department List, Notes Category List, Extra Product, Customer Custom Fields,
      Customer Summary Report, Customer Satisfaction, Price Scheduler, Time-Based Pricing, Ojek Online
      Price List, Product Deposits + Deposit Report, Product Facility + Bookings + Facility Report, Sales
      Quotation/Order/Delivery Lists, Purchase Return Reconciliation, Master Recipes + Recipe Change
      Scheduling, Coupon + Loyalty + Promo & Loyalty Report, Stock Transfer, Stocktake, Buy Marketing
      Campaign, Finance Approvals, Online Orders, Journal Entries, Tax Report. Two false failures in the
      first verification pass were test-script bugs, not app bugs: "Customer Data Setting" and "Customer
      Custom Fields" are two *different* pages (module-behavior settings vs. the field list itself) —
      the test hit the wrong one; and Extra Product's page is per-product (pick a product from a dropdown
      first) — the test wasn't selecting one of the two products that actually had modifier groups.
- [x] Ran a full reseed end-to-end (34s, no errors) and a POS checkout smoke test afterward to confirm
      none of this broke the core sale flow (only additive inserts, no changes to `create_invoice()`).
- [x] Deployed to production (`https://gaweee-retail.vercel.app`, was 15 days stale before this — also
      picked up everything from Phase 13 onward that had never been deployed) and live-verified there too
      that a real production bug report (POS product grid reloading on every tap, already fixed in this
      codebase weeks ago but never deployed) is now actually gone in production.
- [x] 5-outlet demo + Hourly multi-outlet monitoring — the demo company now has 5 outlets (1 primary,
      full 90-day history, + 4 branches — Bandung/Surabaya/Medan/Yogyakarta — each with ~3 weeks of their
      own lighter sales history, own `chart_of_accounts` so `059_auto_post_journal_entries.sql`'s triggers
      actually post for them too, and a manager account each). Per-outlet + company-wide accumulated
      monitoring was already built (`/dashboard/admin/outlets`, generic over however many outlets exist —
      no code change needed there beyond having more than one outlet with real data). Added the "Hourly"
      view on top: `GET /api/admin/outlets/hourly` aggregates revenue/transaction-count by hour-of-day
      across all outlets combined plus per-outlet, and `OutletPerformance` gets a Ringkasan Bulanan/Pola
      Per Jam tab toggle with an outlet selector, reusing the existing `SalesByHourChart` component.
      Live-verified: reseeding twice in a row succeeds cleanly, all 5 outlets show real (non-zero)
      revenue/margin/transaction numbers on the leaderboard, the Hourly chart's "combined" total exactly
      equals the sum of all 5 outlets' individual hourly totals, and switching the outlet selector
      re-renders the chart correctly. Found and fixed one real bug along the way: `purchase_returns.po_id`
      has no `ON DELETE` action (same bug class as migrations 047/050/056/059's wipe-order equivalent) —
      the demo seed's wipe sequence deleted `purchase_orders` before `purchase_returns`, which blocked the
      delete once `purchase_returns` started carrying real `po_id` references (this session's dummy-data
      pass), leaving stale PO rows that collided on `po_number`'s unique constraint on the next reseed.
      Fixed by reordering the wipe (no schema migration needed — this is demo-only data). Deployed to
      production; confirmed there too (same shared Supabase database as local dev).
- [x] "Rincian Harian" (daily breakdown per outlet) — user tried the Hourly/monthly views but still
      couldn't find a day-by-day comparison across outlets, correctly: it didn't exist. Added a third tab
      on `/dashboard/admin/outlets` alongside Ringkasan Bulanan/Hourly: `GET /api/admin/outlets/daily`
      returns 14 days of revenue/transaction-count per outlet plus a combined total (same shape/pattern
      as the Hourly endpoint), rendered as a chart (reusing `SalesByHourChart` again — a bar chart is a
      bar chart regardless of whether the bucket is an hour or a day) plus a comparison table with one
      column per outlet and a Total column, so a specific day's numbers can be read across all 5 outlets
      at once. Live-verified: 14 dates × 5 outlets returned, combined total matches the sum of all
      outlets exactly, and the table renders one row per day with all 5 outlet columns present.
- [x] "Outlet" sidebar entry directly under Dashboard (`lib/nav/config.ts`) — user found the multi-outlet
      monitoring page useful once shown where it was, but wanted faster access than Master Admin →
      Outlets. Added a second entry point right under Sales → Dashboard pointing at the same
      `/dashboard/admin/outlets` page (no route/page duplication — nav items aren't role-filtered
      anywhere in this app, access is already page-gated there for non-master_admin). Live-verified the
      link appears and lands on the per-outlet leaderboard (already the page's default tab).
- [x] POS accent color retheme (green → navy) — header bar, active nav tab, category filter chips,
      selected-customer card, modifier picker selection state, "Bayar Sekarang" toggle, and several focus
      rings switched from hardcoded emerald to the site's `--brand-*` navy/blue palette. Genuinely
      semantic green left alone (positive cash variance, "hemat" savings amount, split-payment fully-paid
      indicator, the Kasir stats strip's categorical color set — matches KPICard's "positive" variant
      convention elsewhere). Live-verified via screenshot + a full checkout smoke test.

## Phase 16 — "Best ERP" gap audit: security, bookkeeping completeness, accessibility, tests
User asked for an honest gap assessment against "the best ERP system there's ever been," then to fix
everything that didn't need a business/credential decision first (rate limiting, login lockout, PO
journal auto-posting, `daily_financial_summary`, accessibility, test coverage). Items still needing the
user's input before they're buildable (tax compliance/e-Faktur, PPh regime, granular RBAC, real
marketplace/WhatsApp API integrations, real payment gateways, production infra/monitoring, CI/CD) are
listed but intentionally NOT started — see the conversation for the full list; not duplicated here since
most already had their own `[!]`-flagged entries above.
- [x] **Login lockout** (`060_login_lockout.sql`) — design-system.md's login spec ("3 percobaan gagal ->
      kunci 15 menit + email keamanan") was never actually implemented; `app/api/auth/login/route.ts`
      returned "Email atau password salah" on every failure with zero attempt tracking, an unlimited-
      attempts brute-force surface. Added `users.failed_login_attempts`/`locked_until`; the login route
      now checks lockout status (admin client, since an unauthenticated request can't read its own row
      under RLS) before even calling `signInWithPassword`, locks for 15 minutes on the 3rd failure, and
      resets on a successful login (which also now sets `last_login_at`, previously always null). The
      "+ email keamanan" half is honestly NOT implemented — no email-sending infrastructure (Resend/
      SendGrid/SMTP) exists anywhere in this codebase to send it with. Live-verified: 3 wrong-password
      attempts lock the account (423 with a countdown message), a 4th attempt with the CORRECT password
      is still rejected during lockout, and a later successful login resets both counters.
- [x] **Rate limiting** (`061_rate_limits.sql`) — no rate limiting existed anywhere in the app (grep
      confirmed it). Added a DB-backed fixed-window limiter (`lib/utils/rateLimit.ts`) — not in-memory,
      since this runs on Vercel serverless where in-memory state doesn't survive a cold start or share
      across instances — wired into login (10/5min per IP, on top of the per-account lockout above, which
      alone doesn't stop credential stuffing spread across many emails), register (5/hour per IP), and the
      public demo seed endpoint (20/min per IP). The window-check logic is split into a pure
      `evaluateRateLimit()` function specifically so it's unit-testable without a Supabase client (5 new
      tests). Live-verified: a 6th register call within an hour gets a 429.
- [x] **Auto-post journal entries for PO receiving** — sales already auto-post (migration 059); PO
      receiving didn't. Added an additive call (same precedent as Petty Cash and the sales triggers, not
      a change to the receive route's core logic) in `app/api/purchase-orders/[id]/receive/route.ts`:
      Dr Persediaan Barang Dagang / Cr Utang Usaha for the received amount, best-effort (missing chart of
      accounts just skips it, wrapped so a bookkeeping failure can never block a real receiving
      transaction). Live-verified: created, submitted, approved, and received a PO, confirmed a balanced
      posted journal entry with the right two account lines.
- [x] **`daily_financial_summary` backfill** — this table has sat completely empty since it was created;
      every report reads live from invoices instead (documented, intentional — no real nightly job
      exists). Added `POST /api/reports/daily-summary/backfill`, same check-on-page-load pattern as Price
      Scheduler: fired once (fire-and-forget) when the financial dashboard mounts, it fills in any of the
      last 7 days that are fully in the past and still missing a row, reusing the same computation
      `GET /api/reports/daily-summary` already does live for "today." Live-verified: 7 rows backfilled
      with real (non-zero) numbers matching actual invoice history — this one runs slower than most
      check-on-load features (7 sequential days × 3 queries each against live Supabase), so give it a
      several-second head start rather than expecting it instantly; it doesn't block the visible dashboard
      either way since it's fire-and-forget.
- [x] **Accessibility audit**: the missing-`name`/`id`-on-`<Input>` bug originally found and fixed once in
      `OnboardingWizard.tsx` (a `<label>` with no `htmlFor` — invisible to screen readers, and to
      Playwright's `getByLabel()`, which is how it was first found) turned out to be everywhere. Swept
      every `<Input>`/`<Textarea>` usage across `components/` and `app/` with a `label` prop and no
      `name`/`id` — found and fixed **123 Input + 2 Textarea instances across 52 files** (full file list
      in the commit). Live spot-checked 3 of the fixed forms via `getByLabel()` afterward to confirm the
      fix actually works end-to-end, not just that a prop was added.
- [x] **Test coverage**: added unit tests for `lib/utils/onlineOrders.ts` (`canTransition()` state machine
      — every legal transition, every illegal skip/backward/out-of-terminal-state move) and
      `lib/utils/chartColors.ts` (`colorForIndex()` — in-range, wraparound, stability), on top of the
      `evaluateRateLimit()` tests above. 39 unit tests passing total, up from 26 at the start of this
      phase. Still well short of the ≥80% coverage goal tracked separately above — this was "add
      meaningful coverage for previously-untested pure logic," not a full coverage push.

## Phase 17 — Fill the remaining Employee/HR/Admin menus with dummy data
User asked to finish what Phase 15 started: every menu should have realistic dummy data, and every
feature should be confirmed working as intended. A fresh audit (row counts across every table Phase 15
hadn't touched) found the entire Employee/HR side of the app, plus a few Sales/Inventory/Master Admin
menus, still completely empty — Phase 15 covered Sales/Inventory/Accounting features but never reached
Employee, and two tables (`item_requests`, `production_runs`) had a wipe step from an earlier phase but
were never actually re-seeded, so those two pages had been silently empty since before Phase 15 too.
- [x] Added `position_levels` (3), `staff_members` (7, positions cashier/staff/supervisor with realistic
      salary/bank/commission data — scoped to `user_id is null` on wipe so the real cashier-role demo
      login's linked staff row is never deleted out from under it), `attendance` (~180 rows, weekday-only,
      present/late/absent mix over 30 days), `shifts` (2) + `staff_schedules` (52, 2 weeks), `payroll_runs`
      (1 paid + 1 draft) + `payslips` (14), `leave_requests` (6, all 3 statuses), `staff_announcements` (5),
      `customer_groups` (2) + `special_prices` (10), `promotions` (4, active/expired mix),
      `bulk_admin_operations` (3 — the page itself is submit-only with no history view, so these don't
      render anywhere yet, but the table/API pairing is real and this is realistic data for if a history
      view gets built later), `checklist_items` (7, opening/closing) + `checklist_completions` (~60 over
      10 days), and backfilled `item_requests` (8) + `production_runs` (3, linked to the existing recipes)
      that an earlier phase's wipe step had been silently emptying with nothing to replace them.
- [x] Live-verified all 15 corresponding pages render this data correctly: Daftar Karyawan, Attendance,
      Buka/Tutup Kasir, Payroll, Jadwal Kerja, Notifikasi, Persetujuan Izin/Cuti, Commission Group List,
      Item Request, Customer Group, Special Pricing Group, Promotion, Bulk Operations, Stock Production
      List, Checklist Activity.
- [x] Ran a full reseed twice in a row (58-62s each, includes the 5-outlet dataset from Phase 15) with
      zero errors both times, confirming the wipe/reseed cycle is stable and doesn't accumulate duplicates
      — and a final smoke test (checkout + the 5-outlet monitoring dashboard) confirmed none of this
      broke anything already working.

## Phase 18 — Sales identification gaps (`062_sales_identification.sql`)
User asked what "identification" features were still missing, specifically for sales. Found two real
gaps: coupon usage was only ever an aggregate counter with no way to trace which invoice actually
redeemed a given coupon, and invoices had no explicit link to the cashier shift they were made during
(reconciliation approximated it via a `created_at` time-range query instead). Migration 062 run;
live-verified end-to-end.
- [x] **Coupon redemption audit trail** — new `coupon_redemptions` table (coupon_id, invoice_id,
      discount_amount, redeemed_by, created_at). `createInvoiceSchema` gained optional `coupon_code`/
      `coupon_discount_amount` fields; `POSScreen` now tracks which coupon was actually applied
      (`appliedCoupon` state, reset on a new transaction) and sends it through at checkout.
      `POST /api/invoices` records the redemption as an additive follow-up after `create_invoice()`
      succeeds (same non-atomic trade-off already used for `sold_unit_label`/notes) — `create_invoice()`
      itself stays untouched. New `GET /api/coupon-redemptions?coupon_id=` + a click-to-expand redemption
      list in `CouponManager` (invoice number, timestamp, discount amount, invoice status) surface it,
      instead of leaving it backend-only. Live-verified: applied a real coupon in the POS, checked out,
      confirmed a `coupon_redemptions` row was written with the exact discount amount and the real
      invoice_id, and confirmed `CouponManager`'s expanded row shows that same invoice number.
- [x] **`invoices.cashier_shift_id`** — stamped at checkout (another additive follow-up) from whichever
      shift is currently open for the outlet; the app only allows one open shift per outlet at a time, so
      there's no ambiguity to resolve. `POST /api/cashier-shifts/:id/close` switched from its old
      `created_at >= shift_start_time` range query to an exact join on this column — correct today either
      way given the single-open-shift constraint, but the explicit link is what actually carries the
      "which shift" fact now instead of a range that happened to work under a rule from a different route.
      Live-verified: opened a shift, made a sale, confirmed the invoice's `cashier_shift_id` matched the
      open shift's id, then closed the shift and confirmed `total_transactions` computed correctly from
      the exact join (no longer the time-range approximation).

## Phase 19 — Loyalty auto-earn + promotion usage tracking (`063_loyalty_and_promotion_completion.sql`)
Continuation of Phase 18's sales-identification audit: two features that turned out to be missing
entirely rather than just missing an audit trail. Loyalty points were 100% manual
(`POST /api/loyalty/adjust`) despite `outlets.loyalty_points_per_1000`/`loyalty_rp_per_point` existing
specifically to configure automatic earning — a customer spending real money never actually earned a
point. `promotions` (distinct from coupons) had zero path from "manager defines a promotion" to "a sale
actually uses it" — the POS never applied one despite a stale code comment claiming otherwise. Migration
063 run; live-verified end-to-end via Playwright against the demo tenant.
- [x] **Loyalty auto-earn** — new `lib/utils/loyalty.ts#earnLoyaltyPoints()`, best-effort and silent on
      any failure (unregistered customer, outlet not configured, DB error) so it can never block or break
      the sale itself. Called from `POST /api/invoices` immediately for a `paid` (cash) invoice, and from
      the e-wallet/Doku/bank webhook and `/simulate-success` settlement routes once a pending payment
      actually clears. `loyalty_ledger.invoice_id` (migration 063) links an auto-earned entry back to the
      sale that earned it. Live-verified: a cash sale to a phone number matching a real seeded customer
      earned the correct point count (`floor(total/1000) * loyalty_points_per_1000`) immediately; an
      e-wallet sale earned zero points while `payment_status` was still `pending`, then earned the correct
      points immediately after `/simulate-success` settled it — confirming points really do wait for
      settlement instead of firing at invoice creation.
- [x] **Promotion application tracking** — new `promotion_applications` table (promotion_id, invoice_id,
      outlet_id, discount_amount, applied_by), the same shape as Phase 18's `coupon_redemptions` for the
      same reason. `POSScreen` now fetches active promotions for the outlet (`is_active` and within
      `start_date`/`end_date`) and renders them as clickable chips; applying one stacks onto the existing
      discount field exactly like a coupon does, and the chosen promotion is sent through at checkout.
      `POST /api/invoices` records the application as an additive follow-up after `create_invoice()`
      succeeds — `create_invoice()` itself stays untouched. New `GET /api/promotion-applications?promotion_id=`
      + a click-to-expand usage list in `PromotionManager` (mirroring `CouponManager`'s pattern exactly:
      invoice number, timestamp, discount amount, invoice total, status) surface it. Live-verified: applied
      a real promotion in the POS, checked out, confirmed a `promotion_applications` row was written with
      the exact discount amount and invoice_id, and confirmed `PromotionManager`'s expanded row lists it.
- [x] **Real bug found and fixed along the way**: `GET /api/customers?search=` only ever matched
      `name ilike`, silently ignoring phone numbers even though the POS's own placeholder text says "Cari
      nama/telepon…" (search by name or phone). Searching by phone returned zero results, which is what
      the live loyalty test caught — confirmed it wasn't a test-script issue by inspecting the route
      directly. Fixed to `.or(name.ilike, phone.ilike)` in `app/api/customers/route.ts`.

## Phase 20 — Loyalty point redemption at checkout
Follow-up audit (same "identification" theme as Phases 18-19, this time scoped to commission, loyalty
tiers, sales returns, gift cards, and point redemption) found one more real gap: `loyalty_ledger` could
record a negative `points_change` (manual redemption via `POST /api/loyalty/adjust`), but nothing in the
POS ever actually let a cashier redeem points for a discount at checkout — the same "defined but never
wired to a real sale" pattern already closed twice for coupons and promotions. Commission (calculated
live from real invoices in `sales-breakdown`/payroll routes), sales returns (`033_customer_refunds.sql`,
already fully wired), and loyalty tiers/gift cards (don't exist as a concept at all, correctly out of
scope) were checked and are NOT gaps. No new migration needed — `loyalty_ledger.invoice_id` already
existed from migration 063.
- [x] `CustomerPicker`'s `PickedCustomer` type gained `id` (previously only carried name/phone, resolved
      server-side by phone match) so the POS can look up a specific customer's point balance directly by
      id instead of re-deriving it — avoids the phone-matching ambiguity the phone-search bug (Phase 19)
      exposed.
- [x] `POSScreen` fetches the outlet's `loyalty_rp_per_point` and, once a customer is selected, their
      current balance (`GET /api/customers/:id/loyalty`, already existed for `LoyaltyManager`). Shows a
      "Tukar Poin" input capped to the fetched balance; applying it stacks onto the discount exactly like
      a coupon/promotion. `POST /api/invoices` gained `loyalty_customer_id`/`redeem_points`, and inserts a
      negative `loyalty_ledger` entry linked to the invoice as an additive follow-up (`create_invoice()`
      untouched) — re-validating the balance server-side rather than trusting the client's last fetch.
- [x] **Real bug found and fixed during live verification**: the redemption entry and an auto-earn entry
      (Phase 19) share the same `invoice_id` + `customer_id`. `earnLoyaltyPoints()`'s idempotency check
      (`invoice_id` + `customer_id` already has a row → skip) matched the redemption row it had nothing to
      do with, so redeeming points on a cash sale silently suppressed that same sale's own point-earning.
      Fixed by scoping the check to `points_change > 0` in `lib/utils/loyalty.ts`.
- [x] Live-verified end-to-end via Playwright: selected a customer with a real 138-point balance, redeemed
      50 points (correctly capped to balance), confirmed the cart discount and final total matched exactly
      (Rp20.000 → -Rp5.000 → Rp22.000 → Rp16.500 with tax), checked out with cash, and confirmed both a
      `-50` redemption row and a separate `+16` auto-earn row landed in `loyalty_ledger` against the same
      invoice — the dedup fix above confirmed working by seeing both rows coexist correctly.

## Phase 21 — Accounts Receivable / Accounts Payable aging reports
Continuation of the same audit pattern (Phases 18-20): a scripted sweep checking every `create table` in
`combined_migration.sql` against `.from('table_name')` usage anywhere in `app`/`lib` found exactly three
tables with zero references outside their own `create table` statement: `accounts_receivable`,
`accounts_payable`, `payment_reconciliation` (all `005_financial.sql`, one of the earliest migrations in
the project). Confirmed there is no AR/AP aging report anywhere in the dashboard at all — not even a raw
list — despite `pay_later` customer invoices and unpaid `purchase_invoices` both already existing as real,
reachable states. `payment_reconciliation` was left alone: it's specifically for reconciling a real
payment gateway's settlement report against GawEEE's own records, and there is no real gateway connected
(`[!]`-blocked on credentials per Phase 4/16) — nothing could ever populate it honestly, unlike AR/AP
which had real data ready to aggregate immediately.
- [x] **`GET /api/reports/accounts-payable`** — supplier aging report computed live from
      `purchase_invoices`/`purchase_payments` (same non-snapshot choice already made for Purchase Return
      Reconciliation), rather than trying to keep the disused `accounts_payable` table in sync. Buckets by
      days past `due_date`: belum jatuh tempo / 1-30 / 31-60 / 61-90 / 90+.
- [x] **`GET /api/reports/accounts-receivable`** — customer aging report computed live from `invoices`
      where `payment_status IN ('pending','partial')`. Matches to a customer by phone, falling back to
      grouping by the raw checkout name when no phone was captured (same disclosed limitation as Customer
      Summary Report — no FK from invoices to customers). Buckets by days since the invoice was created:
      0-30 / 31-60 / 61-90 / 90+.
- [x] New `/dashboard/accounting/accounts-payable` and `/dashboard/accounting/accounts-receivable` pages
      (summary cards, an aging bar chart, a per-supplier/per-customer rollup table, and a full invoice-line
      table), added to the Accounting nav section.
- [x] Live-verified via Playwright against the demo tenant: the demo already had 6 real pending customer
      invoices (some with a matched phone, some walk-ins with no name/phone at all — confirmed both group
      correctly), so AR rendered real aggregated numbers immediately. The demo had zero unpaid supplier
      invoices anywhere (all 13 seeded `purchase_invoices` are `paid`), so AP was seeded one real overdue
      invoice via the actual `POST /api/purchase-invoices` endpoint (same "seed one via the API" approach
      already used verifying Purchase Return Reconciliation in Phase 13H) — confirmed it aggregates
      correctly by supplier and lands in the right aging bucket (44 days overdue → "31-60 hari"). Left in
      place afterward since it's realistic, useful demo data rather than a throwaway test artifact — an
      empty-state-only AP report would be a worse demo than one with something to actually show.

## Phase 22 — Wire up system_alerts (cash variance + payment failed)
Same audit angle as Phase 21, applied to writes instead of whole tables: which tables are ever
`.select()`ed but never `.insert()`ed into by real app logic. `system_alerts` (006_hr_ops.sql) stood out —
its own column comment documents five intended `alert_type` values (`low_stock`, `overstock`,
`payment_pending`, `cash_variance`, `payment_failed`), and `GET /api/notifications` + `NotificationBell`
already read and render unresolved alerts generically (dismiss button, severity color, badge count all
already worked) — but nothing anywhere ever actually inserted a row outside the demo seed. `low_stock`/
`overstock` turned out fine as-is (already covered live via `v_low_stock_alerts`, a deliberately better
mechanism than remembering to insert an alert everywhere — see the code comment on
`GET /api/notifications`). The other two were genuine gaps with a real, already-computed trigger sitting
right there unused.
- [x] **`cash_variance`**: `POST /api/cashier-shifts/:id/close` already computes `cash_variance` (a
      generated column) but never did anything with it besides storing it. Now inserts a `system_alerts`
      row when `abs(variance) >= Rp10.000` (`critical` at ≥ Rp50.000, else `warning`) — additive, after the
      close itself succeeds, so a failed alert insert can never block a shift from closing.
- [x] **`payment_failed`**: the Doku Pay webhook's `FAILED` branch already flips `payment_transactions.status`
      but never surfaced it anywhere a manager would see it. Now inserts a matching alert there too.
- [x] Live-verified `cash_variance` end-to-end: opened a shift with Rp500.000, closed it with Rp550.000
      (Rp50.000 over), confirmed the alert landed with the right severity (`critical`) and message, and
      confirmed it actually renders in `NotificationBell` on the dashboard (screenshotted, correct red dot
      + title + description + timestamp, badge count incremented).
- [x] `payment_failed` could not be verified through the real webhook end-to-end — `DOKU_SECRET_KEY` isn't
      provisioned in this environment (same `[!]`-blocked limitation as the rest of that route, documented
      since Phase 4/16), so the route 501s before reaching the new code at all. Verified the insert's exact
      shape directly against the live `system_alerts` table instead (correct columns/types, no error),
      which is what the new code actually does differently — the surrounding webhook auth/signature logic
      is unrelated, pre-existing, and already covered by that same blocked-on-credentials note.

## Phase 23 — Reverse coupon/loyalty side effects when a sale is voided
Follow-up audit on the additive-follow-up pattern itself: every sales-identification feature this session
(coupon redemption tracking, loyalty auto-earn, loyalty point redemption) was deliberately built as a
non-atomic follow-up after `create_invoice()` rather than a change to it — but `void_invoice()` was never
given the mirror-image treatment. Checked and confirmed: voiding a sale reverses stock and payment status
only. A customer who earned or redeemed loyalty points on a sale later voided within the 24h window kept
that ledger change regardless — free points from a cancelled sale, or real points lost for one. A coupon's
`usage_count` stayed incremented too, wrongly burning into its `usage_limit` for a sale that no longer
counts. `promotion_applications` needed no fix — it has no usage counter to begin with (already disclosed
in Promo & Loyalty Report), and its audit trail already correctly shows "Dibatalkan" via the existing join
to `invoices.order_status` (same join `coupon_redemptions`'s display already used, confirmed working for
that too during verification below).
- [x] `POST /api/invoices/:id/void` gained a best-effort, non-blocking follow-up after the `void_invoice()`
      RPC succeeds (same trade-off as everywhere else this pattern is used — a failure here must never
      surface as an error once the void itself already went through): for every `loyalty_ledger` row tied
      to the voided invoice, inserts a reversal row with the opposite `points_change` (not a delete, so the
      original earn/redeem stays visible in history, same as reversing rather than deleting elsewhere in
      this codebase) with the reason `Pembatalan transaksi {invoice_number}`; for every `coupon_redemptions`
      row tied to it, decrements that coupon's `usage_count` by 1 (floored at 0).
- [x] Live-verified end-to-end: a real POS sale redeeming 10 loyalty points and applying coupon `HEMAT10`
      (auto-earning 13 new points on top), then voided within the 24h window. Confirmed: the invoice's net
      `loyalty_ledger` change is exactly 0 (two reversal rows exactly offsetting the original two), the
      customer's overall balance landed back at precisely its pre-transaction value, `HEMAT10`'s
      `usage_count` dropped back by exactly 1, and `CouponManager`'s expanded redemption list correctly
      shows that redemption as "Dibatalkan."

## Phase 24 — Guard payment settlement against a since-voided invoice
Direct follow-up to Phase 23: checking the reverse direction of the same clock. Phase 23 fixed voiding a
*settled* sale; this checks what happens to a sale voided while its digital payment is still *pending*.
Found none of the three routes that settle a pending payment (`simulate-success`, and the Doku/bank
webhooks — the latter two currently `[!]`-blocked/unreachable without real gateway credentials, same as
always, but the code path exists and will matter the moment they're connected) checked whether the invoice
had been voided in the meantime. A manager can void a sale within 24h while its e-wallet/bank payment is
still awaiting confirmation; without this guard, a late confirmation (a real customer's payment clearing
after the fact, a stale open tab, or — once real gateways are connected — a delayed webhook) would flip a
*voided* invoice's `payment_status` back to `'paid'` and award loyalty points for a sale that officially
no longer exists.
- [x] All three routes now check `invoices.order_status` before settling: `simulate-success` returns 409
      (`"Invoice ini sudah dibatalkan"`) so the POS UI can show a real error; the two webhooks return a
      plain 200 `{status:'ignored'}` instead (never an error status), since a webhook responding with an
      error code typically triggers the gateway to retry indefinitely, and there is nothing to retry here.
- [x] Live-verified `simulate-success` end-to-end: created a real e-wallet sale, voided it while the
      payment was still `pending`, then attempted to confirm that stale payment. Confirmed: rejected with
      409, the invoice stayed `voided`/`pending` (never flipped to `paid`), and the customer's loyalty
      balance was unchanged. The Doku/bank webhooks use the identical guard shape but can't be exercised
      end-to-end in this environment for the same reason nothing else on that path can (no
      `DOKU_SECRET_KEY`/`BANK_VA_SECRET` — see Phase 4/22).

## Phase 25 — Enterprise-grade sales analytics: RFM segmentation + ABC product analysis
User asked to compare against what large enterprise systems (SAP, Oracle, Salesforce-class CRM/retail
tools) typically ship for sales identification — by customer, by hour, by product — and close any real
gap. Sales-by-hour (`peak-time`, both sales and product, plus day-of-week in the same endpoint) and
sales-by-product (Product Report, Product Peak Time, Stock Turnover) were already fully covered. Customer
identification had only raw totals (Customer Summary Report: spend/visits/last-visit) — missing the
segmentation layer every enterprise CRM ships on top of that (RFM: Recency/Frequency/Monetary scoring into
actionable segments). Product identification was missing the classic retail/merchandising Pareto tool
(ABC analysis) for deciding stock-control priority. Both built as live-computed reports, no new tables,
following the exact established report pattern (API + chart + table, added under "Report Analysis").
- [x] **RFM Customer Segmentation** (`/dashboard/sales/analysis/customer-segmentation`) — quintile-scores
      every registered customer with phone-matched purchase history on Recency/Frequency/Monetary (1-5
      each), then classifies into 8 standard segments (Champions, Loyal, Potential, New, At Risk, Can't
      Lose Them, Hibernating, Need Attention) each with a concrete recommended action in the UI — the part
      that makes RFM actually useful to a sales head, not just a score. Same phone-matching disclosure as
      every other invoice-to-customer report in this codebase.
- [x] **ABC Product Analysis** (`/dashboard/sales/analysis/abc-product`) — classic Pareto classification by
      revenue contribution (Class A ≈ top 80% of revenue, B ≈ next 15%, C ≈ remaining 5%), selectable
      30/90/365-day window, per-product revenue/profit/cumulative-%, plus a class-level summary with the
      stock-control implication for each class.
- [x] **Real bug found and fixed during live verification**: RFM's Frequency and Monetary scores were
      exactly inverted — the highest-spending, most-frequent customer in the demo data (Rudi Hartono,
      48 purchases, Rp11.9M) scored F=1/M=1 (worst) while the lowest-value customer scored F=5/M=5 (best).
      Caught by sorting the full customer list by monetary value and checking the score ordering by eye,
      not just checking the API returned 200 with values in the 1-5 range — the bug: recency, frequency,
      and monetary all reused the same "ascending sort, rank 0 = best score" formula, which is only correct
      for recency (fewer days is better); frequency/monetary needed a descending sort since more is better
      there. Fixed by sorting those two descending instead. Re-verified: value order and score order now
      agree across all 10 demo customers, and ABC's cumulative-% column is confirmed monotonically
      non-decreasing and reaches exactly 100%.

## Phase 26 — More enterprise sales analytics + per-outlet dashboard drill-down
Continuation of Phase 25's enterprise-analytics comparison, plus a mid-turn user request: clicking an
outlet in the Master Admin leaderboard should show a full dashboard identical to `/dashboard`, scoped to
just that outlet.
- [x] **Market Basket Analysis** (`/dashboard/sales/analysis/market-basket`) — "customers who bought X
      also bought Y," computed from real invoice baskets with standard association-rule metrics (support,
      confidence, lift). One query for all items in the window, grouped into baskets in memory (not N+1 per
      invoice); oversized baskets (16+ distinct items) are excluded as noise, not a real cross-sell signal.
- [x] **New vs Returning Customer** (`/dashboard/sales/analysis/new-vs-returning`) — monthly customer count
      and revenue split by acquisition (first-ever purchase in that month) vs. retention, the standard
      growth-composition KPI on every enterprise sales dashboard (Shopify Analytics, Square, Amplitude).
      Needs each customer's full purchase history (not just the windowed slice) to correctly classify which
      month they count as "new" in.
- [x] **Void/Cancellation Analysis** (`/dashboard/sales/analysis/void-analysis`) — loss-prevention report:
      void rate and value overall, per-cashier (grouped by the ORIGINAL cashier who rang the sale, not who
      approved the void — void_invoice() requires manager+, so that's never the interesting signal), by
      reason, and a daily trend. A concentrated or spiking void rate on one cashier is one of the most
      common employee-fraud signals in retail (e.g. "sweethearting").
- [x] **Per-outlet dashboard drill-down** — clicking a row in the Outlet leaderboard now opens
      `/dashboard/admin/outlets/:id`, rendering the exact same components as the main `/dashboard`
      (TodayOverview, low-stock list, SalesAnalytics, SalesReportGrid) but scoped to that one outlet
      instead of the caller's own. Required adding an optional `outlet_id` query-param override (with a
      `canAccessOutlet` permission check) to the three report APIs backing those components
      (`daily-summary`, `sales-trend`, `sales-breakdown`), which previously only ever read the caller's own
      `auth.outlet_id` — non-breaking for every existing caller, since the param defaults to that same
      value when omitted.
- [x] Live-verified all four: Market Basket found real, sensible pairs (top lift 8.93x, "Wortel Potong Beku
      500gr" + "Bumbu Soto Instan 200gr"); New vs Returning showed the expected shape (10 customers all
      acquired in one earlier month, 89.9% of revenue since from returning transactions — matches a fixed
      10-customer demo roster); Void Analysis correctly picked up the real test-void invoices created
      earlier this session (Phase 23/24's verification voids) with accurate reasons and a 1.4% void rate;
      the outlet drill-down renders identically to `/dashboard` (screenshotted) for a specific outlet,
      correctly showing that outlet's own zero-sales-today state independent of the demo's other outlets.

## Phase 27 — Sales Target vs Actual tracking
Continuation of the enterprise-analytics sweep: `outlets.target_daily_revenue` has existed in the schema
(and even in `database.types.ts`) since the very first migration, but was never read or written by any
route or UI — the exact "defined but never wired" pattern closed repeatedly this session (AR/AP, system
alerts, loyalty redemption). Target vs. actual is one of the most fundamental tools in any enterprise sales
system, so this closes it properly rather than just adding a report on top of dead data.
- [x] `PATCH /api/outlets/:id` and `OutletSettingsForm` (Pengaturan > Outlet Info) gained a "Target
      Penjualan Harian" field, so a manager/master_admin can actually set the value that's existed unused
      all along.
- [x] `GET /api/reports/target-vs-actual` (`outlet_id` optional, same master_admin drill-down override as
      the other Phase 26 report APIs) — today's achievement %, month-to-date actual vs. target, a full-month
      projection, and the daily pace still needed to hit it. New `TargetVsActualReport` surfaced in three
      places: its own page, the main `/dashboard` (right under Today's Overview — where an owner actually
      checks daily), and the outlet drill-down page.
- [x] **Real timezone bug found and fixed before shipping**: the route's own date-boundary/day-key logic
      used local-timezone `Date` construction (`new Date(year, month, day)`, `.getDate()`) while
      `invoices.created_at` is a UTC `timestamptz` compared/grouped by its UTC calendar date everywhere
      else in the app. On this UTC+7 dev machine that silently shifted every date boundary by up to a day —
      the month-start query filter leaked ~7 hours of the *previous* month's invoices into the MTD total,
      and the daily chart's date keys were mislabeled by one day, which also made `today`'s actual always
      read as 0 (its lookup key never matched a real day in the shifted map). Caught by cross-checking the
      API's numbers against a raw, independent DB query rather than just eyeballing the chart. Fixed by
      switching every boundary/key to UTC-safe construction (`Date.UTC(...)`, `.getUTCDate()`, etc.) —
      re-verified against the same raw query afterward, exact match (MTD total and a spot-checked day both
      matched precisely; today's actual correctly read 0, matching an independent count of 0 real invoices
      today rather than the bug coincidentally also producing 0).
- [!] Given how easily this bug class slipped in, worth auditing the *other* report routes doing day/month
      bucketing (`sales-trend`, `peak-time`, `daily-summary`, `new-vs-returning`, `void-analysis`, the
      admin outlet hourly/daily routes) for the same local-vs-UTC mismatch — investigation in progress,
      not yet confirmed which (if any) of those are actually affected or how serious each one is before
      deciding what, if anything, needs fixing there too.

## Phase 28 — Date range, outlet scope, and Excel export across every report (part 1)
User asked for three things on every "identification" report: a custom date-range picker (not just preset
day-count buttons), a choice between all outlets combined or one specific outlet, and an Excel-compatible
export button. Built three reusable pieces (`<DateRangePicker>`, `<OutletSelector>`, `resolveDateRange()`,
`resolveOutletScope()` — the latter two server-side helpers so every route applies the exact same UTC-safe
boundary logic and outlet-scoping rules) and rolled them out to the first batch of reports. Reusing the
existing `ExportCsvButton`/`exportToCsv()` (CSV with a UTF-8 BOM — already documented as "opens directly in
Excel") rather than adding a new `xlsx` library dependency for an equivalent practical result.
- [x] New `GET /api/outlets` (lightweight list, backs `<OutletSelector>`) and `resolveOutletScope()` —
      `outlet_id=all` aggregates every outlet in the caller's company (master_admin only; collapses to the
      same single outlet for anyone else, so it's never gated as a special case), a specific id is checked
      against the existing `canAccessOutlet()`, and no param falls back to the caller's own outlet for
      backward compatibility with every report built before this existed.
- [x] `resolveDateRange()` — explicit `start`/`end` (YYYY-MM-DD, from `<DateRangePicker>`) or a `days`
      fallback, always resolved into UTC-safe `T00:00:00.000Z`/`T23:59:59.999Z` boundary strings. Since this
      touches the exact same boundary-construction code the Phase 27 timezone-bug audit flagged across
      several routes, using it fixes that bug as a side effect everywhere it's applied this batch:
      `sales-trend` (dashboard chart + current-vs-previous comparison — the audit's most serious finding
      besides the outlet leaderboard, since local Date boundaries were misattributing real invoices between
      "current" and "previous" period, not just mislabeling chart dates), `peak-time` (also switched
      hour/day-of-week bucketing to `getUTC*()`, since the whole chart was systematically reshuffled by the
      server's UTC offset), `sales-breakdown`, `stock-turnover`, `customer-summary`, `settlement-report`,
      `deposit`, and `GET /api/admin/outlets` (the outlet leaderboard's MTD revenue — found and fixed while
      splitting this page, below).
- [x] Rolled out to: Sales Trend/dashboard chart, Product & Sales Peak Time, Stock Turnover, Customer
      Summary, Cashier Report, Employee Report, Inventory Report, Settlement Report, Deposit Report,
      Promo & Loyalty Report (outlet scope only — coupons/promotions are current-state lists, not
      date-filtered). Every page-level wrapper that used to gate rendering behind
      `profile?.outlet_id` (breaking these pages for master_admin, whose own `outlet_id` is null) now
      always renders and lets the component's own `<OutletSelector>` handle scope — a real, previously-
      unnoticed gap this closed as a side effect: Product/Sales Peak Time (and by the same pattern, every
      other report converted this batch) were completely unusable by a master_admin before this.
- [x] **Split the combined Outlet page on request** — Master Admin > Outlets (`/dashboard/admin/outlets`)
      was serving both master-data CRUD (add outlet, the same form) and sales identification (MTD
      leaderboard, hourly/daily patterns, the Phase 26 per-outlet drill-down) from one component. Split
      into `OutletMasterData` (pure CRUD: list/create/activate-toggle, backed by a new lightweight
      `GET /api/admin/outlets/list`) staying at `/dashboard/admin/outlets`, and the identification view
      (`OutletPerformance`, CRUD form removed) moved to `/dashboard/sales/outlet` under Sales — matching
      where every other identification report already lives — with its drill-down moving to
      `/dashboard/sales/outlet/:id`. `PATCH /api/outlets/:id` gained `status` so the new activate/deactivate
      toggle has somewhere to write.
- [x] Live-verified: outlet_id=all vs. one outlet on sales-trend showed the expected relationship (all 5
      outlets combined ≥ any single one); Product/Sales Peak Time now render real data for master_admin
      instead of the old "pilih outlet" dead end; the master-data and identification pages render
      distinctly (checked each page does NOT show the other's defining content — no "Revenue MTD" on the
      CRUD page, no "+ Tambah Outlet" on the identification page); the drill-down still works at its new
      URL; the status activate/deactivate toggle round-tripped correctly through a real PATCH.
- [x] **Part 2 — finished the rollout.** Converted the rest: Facility Report, Service Report (full date
      range + outlet scope + export), Customer Satisfaction (export button only — kept as a manual
      review-logging tool, not a date/outlet-filtered report), Tax Report (dropped its ad-hoc `start`/`end`
      handling and local-timezone year default for `resolveDateRange`/`resolveOutletScope`, default window
      is the current year), Customer Segmentation/RFM and ABC Analysis and Market Basket (outlet scope +
      export; ABC/Market Basket's old 30/90/365-day dropdown became a real `<DateRangePicker>`), New vs
      Returning (kept its month-count dropdown since it's month-bucketed, added outlet scope + export, and
      fixed a local-timezone bug in the month-window construction — `new Date(y, m, 1)` + `.getMonth()`
      could add/drop a month boundary depending on server timezone), Void Analysis (full date range + outlet
      scope + export, replacing its old `days`-dropdown + single-outlet-only route), Target vs Actual
      (its own report page gained an outlet selector; the two pinned dashboard/drill-down usages keep their
      single-outlet prop unchanged since those are per-outlet widgets, not standalone reports — `outlet_id=
      all` on the route now sums every in-scope outlet's target and actuals together), and AR/AP (both
      previously had zero outlet scoping or export at all — now outlet-scoped with export, and both had a
      local-timezone day-diff bug fixed: AR's `days_outstanding`/AP's `days_overdue` compared a local-
      midnight `today` against a UTC-derived date, which could be off by one near local midnight).
- [x] Closed the last two timezone-bug routes the Phase 27 audit flagged: `app/api/accounting/reports/route.ts`
      (P&L's `firstDayOfMonth()` default now builds the boundary from `getUTCFullYear()`/`getUTCMonth()`
      instead of local getters) and `app/api/admin/outlets/hourly` / `.../daily` (switched to
      `resolveDateRange()` for their boundaries and `getUTCHours()` for hour bucketing, matching the fix
      already applied to `peak-time`).
- [x] Verified: `npx next typegen && npx tsc --noEmit` clean, ESLint clean on every touched file, `npm run
      build` compiled successfully (243 routes). Live-verified via a Playwright script against the demo
      account (port 3001): logged in, loaded all 9 newly-touched report pages with no errors and the
      expected selects/date-inputs/export-button present, then hit 7 of the underlying API routes directly
      with `outlet_id=all` — all returned 200 with sane aggregated numbers (e.g. target-vs-actual's MTD
      actual/target scaled correctly across all outlets combined) and zero browser console errors.

## Phase 29 — E2E regression coverage for the void-invoice fraud-prevention gate
With every tracked feature phase complete, went looking for real remaining gaps rather than inventing
busywork: grepped for TODO/FIXME (none), checked CI (`.github/workflows/ci.yml` — lint + unit tests + build
on every push, solid), and counted test coverage. Found a genuine one — only 4 e2e specs existed
(auth, pos, signup-login-roundtrip, journal-accounting-integration), and `void_invoice()` — the exact
manager-only fraud-prevention gate this session's own `void-analysis` report docstring calls out as a real
"sweethearting" signal (ring a sale, void it after the customer leaves with the goods) — had zero e2e
coverage despite being one of the money-critical paths this codebase leans on most.
- [x] Added `tests/e2e/void-invoice.spec.ts`, two tests: (1) a cashier cannot void an invoice — the UI hides
      the "Batalkan Transaksi" button, AND a direct bypass call straight to `POST /api/invoices/:id/void`
      with the cashier's own session still gets rejected with 403 (defense in depth, both layers checked
      independently); (2) a manager can void a sale with a reason, and the exact quantity sold is restored
      to `inventory.quantity_on_hand` — not just a status-flip check, a real before/after stock delta
      assertion against the API.
- [x] Both the product to sell and the disposable cashier account are discovered/created dynamically rather
      than hardcoded: found live that `lib/demo/catalog.ts`'s documented `DEMO_CASHIER_EMAIL` no longer
      shares a company with `DEMO_EMAIL` in the actual shared dev/prod database (RLS would make them unable
      to see each other's invoices at all after months of manual testing on top of the original seed) — so
      the cashier test instead creates a same-company, same-outlet cashier fresh via `POST /api/admin/users`
      and deletes it at the end, sidestepping that drift entirely. Likewise the product to sell is picked
      from a live `GET /api/inventory/:outletId` call (first in-stock item) rather than a name that might no
      longer exist in the current catalog.
- [x] Uses two independent Playwright browser contexts (manager + cashier) rather than logging one page in
      and out repeatedly — found live that `/auth/login` redirects straight back to `/dashboard` when a
      session is already active, so a same-page relogin needs an explicit logout first, and doing that
      3+ times per test pushes uncomfortably close to the login route's IP rate limit (10/5min). Two
      contexts also model "two different concurrent users" more honestly.
- [x] Every test cleans up after itself (voids its own test invoice, deletes its disposable cashier) so
      repeated local runs don't accumulate junk invoices, drain real product stock, or pile up throwaway
      users in the shared demo database.
- [x] Verified: `npx tsc --noEmit` and `eslint` clean, `npm test` (jest, unrelated but re-run as a sanity
      check) 59/59 passing, and the new spec itself green — `npx playwright test tests/e2e/void-invoice.spec.ts`
      2 passed — against the live dev server on port 3001.
- [x] **Follow-up same phase**: extracted the shared login/outlet/product-discovery helpers into
      `tests/e2e/helpers.ts` (not itself a test file) and refactored `void-invoice.spec.ts` to use it, then
      added `tests/e2e/settlement-void-race.spec.ts` covering the *other* half of the same race: todo.md
      Phase 24's guard against confirming a pending e-wallet/bank payment on an invoice that's since been
      voided (`app/api/payments/[paymentId]/simulate-success/route.ts`'s `order_status === 'voided'` check)
      — verified manually once, live, when Phase 24 shipped, now a permanent repeatable check. Walks a real
      e-wallet checkout to the QR screen, voids the invoice before confirming payment, then asserts the late
      "webhook" (`simulate-success`, today's demo stand-in for the real Doku/Bank VA one) is rejected with
      409 `"Invoice ini sudah dibatalkan"` and that `payment_status` stays `'pending'` rather than flipping
      to `'paid'`. Both new/refactored files typecheck, lint, and pass in isolation and run together; running
      the *entire* e2e suite back-to-back can trip the login route's 10-req/5-min IP rate limit purely from
      volume (confirmed pre-existing — `signup-login-roundtrip.spec.ts` hit it too in the same full-suite
      run, not something these two files introduced) — a known characteristic of a real rate limiter meeting
      a fast local test run, not a defect to fix.
- [x] **Follow-up**: added `tests/e2e/split-payment.spec.ts` — split payment (todo.md Phase 11, a sale paid
      across up to 2 methods at once) had shipped with only a manual live regression pass and no permanent
      test since. Splits a real sale across cash + e-wallet, settles the pending e-wallet portion via the
      same `simulate-success` stand-in, and asserts the money actually reconciles: `payment_transactions`
      sums to exactly the invoice total (2 rows) and `payment_status` lands on `'paid'` — not just that the
      UI didn't error. Reads the cart total off the checkout button's own live label rather than
      recomputing it, so the assertion is independent of any client-side total math. Typechecks, lints, and
      passed on first run against the live dev server.
- [x] **Follow-up**: added `tests/e2e/multi-tenant-isolation.spec.ts` — the single most fundamental
      guarantee of a multi-tenant SaaS (prd.md §2.3) had zero test coverage: nothing verified that one
      company can never read another company's data. Provisions a completely fresh, disposable company +
      owner directly via the same SECURITY DEFINER RPC (`provision_company_and_owner`)
      `app/api/auth/register` itself calls — bypassing that HTTP route (and its 5/hour IP rate limit,
      already shared by `auth.spec.ts`/`signup-login-roundtrip.spec.ts`) entirely — then, logged in as that
      fresh company's owner, confirms `GET /api/invoices/:id` and `GET /api/products/:id` for a real invoice
      and product belonging to the demo company both come back 404 (not found, not "forbidden" — RLS makes
      the row simply not exist for this session), and that `GET /api/outlets` lists only the isolated
      company's own outlet. Passed on first run — RLS is working as designed; this makes that guarantee
      permanently checked instead of merely assumed. Cleans up its disposable company/user/auth account
      unconditionally (`finally` block) so repeated runs don't accumulate fixture companies; verified with a
      direct DB query afterward that none were left behind.
- [x] Moved `createCashSale` (used identically by three of the four specs above) into `tests/e2e/helpers.ts`
      alongside the other shared checkout/login helpers, removing the duplicate from `void-invoice.spec.ts`.
      Re-ran every affected spec after the refactor to confirm nothing broke.
- [x] **Follow-up**: added `tests/e2e/customer-refund.spec.ts` — the customer refund/return flow
      (`app/api/customer-refunds`, draft-then-submit) is another real money-and-stock-movement path that had
      no e2e coverage. Refunds the single item from a freshly created paid sale through the real UI form and
      checks its stock actually comes back — the same before/after `quantity_on_hand` delta assertion used
      by the void tests. Passed on first run.
- [x] With this, the money-critical/security-critical paths this phase set out to close are now all covered:
      void's fraud gate, the void-vs-pending-settlement race, split payment reconciliation, multi-tenant RLS
      isolation, and customer refunds — 5 new e2e spec files (`void-invoice`, `settlement-void-race`,
      `split-payment`, `multi-tenant-isolation`, `customer-refund`) plus a shared `helpers.ts`, growing the
      e2e suite from 4 files to 9. Every file typechecks, lints, and passed on a live run against the demo
      account; `npm test` (jest) re-run clean (59/59) after each addition as a sanity check that nothing
      app-side regressed.

## Notes on scope
This todo tracks the **engineering deliverables** of the PRD (a working Next.js + Supabase codebase
implementing Phase 1 features, with payment gateways behind a swappable mock interface). Items marked
`[!]` are blocked on secrets, accounts, or approvals only the user can provide — everything else will be
built incrementally and reported as it lands, in commits pushed to the connected GitHub repo.
