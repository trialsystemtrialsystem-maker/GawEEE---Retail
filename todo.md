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
- [ ] Tax report calculation (PPN/PPh) — not started, placeholder page in place
- [ ] Integration test: transaction → journal entry → P&L accuracy — no journal entries are written
      yet (see above), so this can't be meaningfully tested until that's wired up
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
- [ ] Color redesign only touched the highest-impact structural surfaces (sidebar, header, KPI cards,
      landing hero) — most smaller components still use the original gray/blue Tailwind utility classes
      rather than the new brand tokens throughout. A full systematic pass wasn't attempted (large
      surface area, diminishing returns for the time available).
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

## Notes on scope
This todo tracks the **engineering deliverables** of the PRD (a working Next.js + Supabase codebase
implementing Phase 1 features, with payment gateways behind a swappable mock interface). Items marked
`[!]` are blocked on secrets, accounts, or approvals only the user can provide — everything else will be
built incrementally and reported as it lands, in commits pushed to the connected GitHub repo.
