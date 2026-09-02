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

  **Phase 12 complete — all 4 batches shipped.** Batches A/B fully live-verified working end-to-end
  (visual redesign, Riwayat Kasir + reprint, Laporan Harian with real charts). Batch C's 3 features
  (Absensi, Izin, Checklist) are code-complete and verified to degrade gracefully, but need migrations
  `038`, `039`, `040` run in Supabase before they're actually usable — same as every other
  new-table Phase 11/12 item. Batch D's demo entry point works today for Kasir/Riwayat/Laporan; once
  038-040 run, the same demo button will also exercise Absensi/Checklist/Izin with real data.

## Notes on scope
This todo tracks the **engineering deliverables** of the PRD (a working Next.js + Supabase codebase
implementing Phase 1 features, with payment gateways behind a swappable mock interface). Items marked
`[!]` are blocked on secrets, accounts, or approvals only the user can provide — everything else will be
built incrementally and reported as it lands, in commits pushed to the connected GitHub repo.
