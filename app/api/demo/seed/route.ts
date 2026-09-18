import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, clientIp } from '@/lib/utils/rateLimit'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import {
  DEMO_CATEGORIES,
  DEMO_PRODUCTS,
  DEMO_SUPPLIERS,
  DEMO_CUSTOMER_NAMES,
  DEMO_COMPANY_NAME,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CASHIER_EMAIL,
  DEMO_CASHIER_PASSWORD,
  DEMO_CASHIER_NAME,
} from '@/lib/demo/catalog'

// POST /api/demo/seed — public, unauthenticated (this is the landing page's
// "Coba Demo" button). Resets and regenerates a fixed demo tenant with ~3
// months of realistic frozen-food transaction history, then returns the demo
// login so the client can sign in immediately after. Every call re-seeds the
// SAME tenant (looked up by DEMO_EMAIL) rather than creating a new one each
// time, so repeated clicks can't spawn unbounded tenants — a reasonable
// safeguard for a public unauthenticated endpoint given no rate-limiting
// infra exists yet (see todo.md).
//
// Response latency: the full regenerate (below) takes ~15-20s. Data is
// backdated so its most recent invoice lands "today", so once a day rolls
// over the existing data is technically stale. Rather than pay that cost on
// every first click of a new day, only a genuinely-empty tenant (nothing to
// show at all) blocks on the full regenerate; a merely-stale tenant responds
// immediately with its existing (still fully functional, just a day or so
// old) data and refreshes in the background. See the branching in POST().

const DAYS_OF_HISTORY = 90
const TAX_RATE = 0.1

// There's exactly one demo tenant (see the comment above), so a single
// in-flight promise is enough to guard it: without this, two overlapping
// calls to regenerateDemoData() (e.g. rapid repeated clicks/requests, since
// the "stale" path below responds immediately and reseeds in the
// background) each take their own snapshot of invoiceIds/etc. at slightly
// different times — the later one's wipe misses rows the earlier one just
// inserted, leaving orphans that then fail the products delete with a
// foreign key violation. Concurrent calls now just await the same run.
let activeReseed: Promise<Awaited<ReturnType<typeof regenerateDemoData>>> | null = null
function reseedOnce(admin: SupabaseClient<Database>, companyId: string, outletId: string, userId: string) {
  if (!activeReseed) {
    activeReseed = regenerateDemoData(admin, companyId, outletId, userId).finally(() => {
      activeReseed = null
    })
  }
  return activeReseed
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}
function weightedPickProduct<T extends { popularity: number }>(products: T[]): T {
  const total = products.reduce((s, p) => s + p.popularity, 0)
  let r = Math.random() * total
  for (const p of products) {
    r -= p.popularity
    if (r <= 0) return p
  }
  return products[products.length - 1]
}

export async function POST(request: NextRequest) {
  // Public, unauthenticated endpoint (see the module comment above) — a
  // light per-IP rate limit on top of reseedOnce()'s concurrency guard and
  // the "always the same tenant" design, since neither of those actually
  // stops a script from just hammering this route.
  const ipLimit = await checkRateLimit(`demo-seed:${clientIp(request)}`, 20, 60)
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan, coba lagi sebentar lagi.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const body = await request.json().catch(() => ({}))
  const wantsCashierLogin = body?.role === 'cashier'

  // 1) Find or create the demo tenant (owner user + company + outlet).
  let companyId: string
  let outletId: string
  let userId: string

  const { data: existingUser } = await admin.from('users').select('id, company_id, outlet_id').eq('email', DEMO_EMAIL).maybeSingle()

  if (existingUser) {
    userId = existingUser.id
    companyId = existingUser.company_id
    outletId = existingUser.outlet_id!
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? 'Gagal membuat akun demo' }, { status: 500 })
    }
    const { data: provisioned, error: provisionError } = await admin
      .rpc('provision_company_and_owner', {
        p_user_id: created.user.id,
        p_email: DEMO_EMAIL,
        p_full_name: 'Demo Owner',
        p_phone: '081200000000',
        p_company_name: DEMO_COMPANY_NAME,
        p_tier: 'professional',
        p_industry: 'frozen_food',
      })
      .single()
    if (provisionError) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
      return NextResponse.json({ error: provisionError.message }, { status: 500 })
    }
    userId = created.user.id
    companyId = provisioned.company_id
    outletId = provisioned.outlet_id
  }

  // 1a2) If a cashier-role login was requested (the "Coba DEMO POS System
  // Instan" landing button — Phase 12), find-or-create a second users row +
  // a linked staff_members row (via the user_id column from migration 038)
  // on the SAME outlet, so the Absensi self-service page works out of the
  // box in the demo too. Reuses the admin's already-seeded 90 days of
  // history — the point is showing off a fully-populated POS, not a
  // cashier-specific sales history.
  let loginEmail = DEMO_EMAIL
  let loginPassword = DEMO_PASSWORD
  if (wantsCashierLogin) {
    const { data: existingCashier } = await admin.from('users').select('id').eq('email', DEMO_CASHIER_EMAIL).maybeSingle()
    let cashierUserId: string
    if (existingCashier) {
      cashierUserId = existingCashier.id
    } else {
      const { data: createdCashier, error: createCashierError } = await admin.auth.admin.createUser({
        email: DEMO_CASHIER_EMAIL,
        password: DEMO_CASHIER_PASSWORD,
        email_confirm: true,
      })
      if (createCashierError || !createdCashier.user) {
        return NextResponse.json({ error: createCashierError?.message ?? 'Gagal membuat akun kasir demo' }, { status: 500 })
      }
      cashierUserId = createdCashier.user.id
      const { error: insertCashierError } = await admin.from('users').insert({
        id: cashierUserId,
        company_id: companyId,
        outlet_id: outletId,
        email: DEMO_CASHIER_EMAIL,
        full_name: DEMO_CASHIER_NAME,
        phone: '081200000001',
        role: 'cashier',
      })
      if (insertCashierError) {
        await admin.auth.admin.deleteUser(cashierUserId).catch(() => {})
        return NextResponse.json({ error: insertCashierError.message }, { status: 500 })
      }
    }

    const { data: existingStaffRow } = await admin.from('staff_members').select('id').eq('user_id', cashierUserId).maybeSingle()
    if (!existingStaffRow) {
      await admin.from('staff_members').insert({
        outlet_id: outletId,
        first_name: DEMO_CASHIER_NAME,
        email: DEMO_CASHIER_EMAIL,
        position: 'cashier',
        hire_date: new Date().toISOString().slice(0, 10),
        status: 'active',
        user_id: cashierUserId,
      })
    }

    loginEmail = DEMO_CASHIER_EMAIL
    loginPassword = DEMO_CASHIER_PASSWORD
  }

  // 1b) Fast path: the seeder always backdates its most recent invoice to
  // "today" (see the day-by-day loop in regenerateDemoData), so if that's
  // still true the existing data is fresh — skip the ~20s wipe-and-regenerate
  // entirely and just hand back the login.
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: latestInvoice } = await admin
    .from('invoices')
    .select('created_at')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestInvoice && latestInvoice.created_at.slice(0, 10) === todayStr) {
    return NextResponse.json({
      email: loginEmail,
      password: loginPassword,
      company_id: companyId,
      outlet_id: outletId,
      stats: { reused_existing_data: true },
    })
  }

  // 1c) A genuinely empty tenant (first-ever seed, or a wipe with no data
  // yet) has nothing to show — must block on the full regenerate.
  if (!latestInvoice) {
    try {
      const stats = await reseedOnce(admin, companyId, outletId, userId)
      return NextResponse.json({ email: loginEmail, password: loginPassword, company_id: companyId, outlet_id: outletId, stats })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal menyimpan data demo' }, { status: 500 })
    }
  }

  // 1d) Data exists but is stale (from a previous day) — it's still fully
  // functional (just not literally dated "today"), so respond immediately
  // and refresh it in the background instead of making every day's first
  // click pay the ~20s regeneration cost. (On a serverless/edge deployment
  // this would need to move to a scheduled job or a `waitUntil()`-style API,
  // since the process isn't guaranteed to keep running after the response is
  // sent — fine for the current self-hosted/Node deployment.)
  void reseedOnce(admin, companyId, outletId, userId).catch((err) => {
    console.error('[demo-seed] background reseed failed:', err)
  })

  return NextResponse.json({
    email: loginEmail,
    password: loginPassword,
    company_id: companyId,
    outlet_id: outletId,
    stats: { reused_existing_data: true, refreshing_in_background: true },
  })
}

/** Wipes and regenerates the demo tenant's ~3 months of transaction history.
 * Throws on failure (callers decide whether to await it and surface the
 * error, or fire it in the background and just log). */
async function regenerateDemoData(admin: SupabaseClient<Database>, companyId: string, outletId: string, userId: string) {
  // 2) Wipe any previous demo data for this tenant (idempotent reset), in
  // FK-safe order. Sequential deletes rather than one SQL function: this is
  // demo-only data, so a partial failure is low-stakes (same trade-off as PO
  // receiving — see that route's comment).
  const invoiceIds = (await admin.from('invoices').select('id').eq('outlet_id', outletId)).data?.map((i) => i.id) ?? []
  const poIds = (await admin.from('purchase_orders').select('id').eq('outlet_id', outletId)).data?.map((p) => p.id) ?? []
  const purchaseInvoiceIds = poIds.length
    ? (await admin.from('purchase_invoices').select('id').in('po_id', poIds)).data?.map((p) => p.id) ?? []
    : []

  if (purchaseInvoiceIds.length) await admin.from('purchase_payments').delete().in('purchase_invoice_id', purchaseInvoiceIds)
  if (purchaseInvoiceIds.length) await admin.from('purchase_invoices').delete().in('id', purchaseInvoiceIds)
  // Must come before the purchase_orders delete below: purchase_returns.po_id
  // has no ON DELETE action (RESTRICT, same bug class as 047/050/056) and
  // this seeder now populates it with real PO references (for reconciliation
  // demo data) — deleting purchase_orders first left stale, un-deletable PO
  // rows behind, which then collided on po_number's unique constraint on the
  // very next reseed. purchase_return_items cascades from return_id.
  await admin.from('purchase_returns').delete().eq('outlet_id', outletId)
  if (poIds.length) await admin.from('po_items').delete().in('po_id', poIds)
  if (poIds.length) await admin.from('purchase_orders').delete().in('id', poIds)
  if (invoiceIds.length) await admin.from('payment_transactions').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('virtual_accounts').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('invoice_items').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('customer_refunds').delete().in('invoice_id', invoiceIds)
  // journal_entries.source_id is a loose polymorphic reference (no FK), so
  // it doesn't block the invoices delete below — but it also won't get
  // cascade-cleaned by it, and 059_auto_post_journal_entries.sql now posts
  // one to three of these per invoice. journal_entry_details cascades from
  // this delete (its FK is ON DELETE CASCADE).
  await admin.from('journal_entries').delete().eq('outlet_id', outletId)
  await admin.from('invoices').delete().eq('outlet_id', outletId)
  await admin.from('inventory_ledger').delete().eq('outlet_id', outletId)
  await admin.from('inventory').delete().eq('outlet_id', outletId)
  await admin.from('system_alerts').delete().eq('outlet_id', outletId)
  await admin.from('audit_log').delete().eq('company_id', companyId)
  await admin.from('held_transactions').delete().eq('outlet_id', outletId)
  await admin.from('cashier_shifts').delete().eq('outlet_id', outletId)
  await admin.from('product_bundles').delete().eq('outlet_id', outletId)

  // Phase 13 menus that previously had zero (or a handful of leftover
  // one-off test rows) demo data — wiped here so every reseed regenerates a
  // consistent ~2 months of history for them too, instead of accumulating
  // stale rows across repeated reseeds. None of these block the products
  // delete below via their own FK (no product_id reference, or cascades
  // from a parent already wiped), except product_deposits — that one's
  // wiped in the "every table with a product FK" block further down.
  await admin.from('customer_reviews').delete().eq('outlet_id', outletId)
  await admin.from('facilities').delete().eq('outlet_id', outletId) // bookings.facility_id is ON DELETE SET NULL
  await admin.from('bookings').delete().eq('outlet_id', outletId)
  await admin.from('coupons').delete().eq('outlet_id', outletId)
  await admin.from('campaign_requests').delete().eq('outlet_id', outletId)
  await admin.from('expense_requests').delete().eq('outlet_id', outletId)
  await admin.from('online_orders').delete().eq('outlet_id', outletId)
  await admin.from('customer_field_definitions').delete().eq('outlet_id', outletId)
  await admin.from('note_presets').delete().eq('outlet_id', outletId)
  // loyalty_ledger.customer_id is ON DELETE CASCADE, so wiping customers
  // clears it too.
  await admin.from('customers').delete().eq('outlet_id', outletId)

  // Every other table with a (non-cascading, from products' side) FK to
  // products.id — anything left un-wiped here makes the products delete
  // below fail with a 23503 foreign key violation, which the codebase found
  // out about the hard way: a stocktake done against the demo tenant in an
  // earlier phase (stocktake_details -> products) silently blocked every
  // reseed since, because this delete's error wasn't checked (fixed below
  // too). production_runs must go before recipes since it references
  // recipes(id) without cascade; the *_items/details children of
  // recipes/purchase_returns/stocktakes/stock_transfers all cascade
  // automatically from their parent's `on delete cascade`.
  await admin.from('production_runs').delete().eq('outlet_id', outletId)
  await admin.from('recipes').delete().eq('outlet_id', outletId)
  await admin.from('product_deposits').delete().eq('outlet_id', outletId)
  await admin.from('item_requests').delete().eq('outlet_id', outletId)
  // purchase_returns is already wiped earlier (before the purchase_orders
  // delete it would otherwise block — see that comment) — not repeated here.
  await admin.from('special_prices').delete().eq('outlet_id', outletId)
  await admin.from('stock_transfers').delete().eq('company_id', companyId)
  await admin.from('stocktakes').delete().eq('outlet_id', outletId)
  await admin.from('sales_quotation_items').delete().in('quotation_id', (await admin.from('sales_quotations').select('id').eq('outlet_id', outletId)).data?.map((q) => q.id) ?? [])
  await admin.from('sales_quotations').delete().eq('outlet_id', outletId)
  await admin.from('sales_order_items').delete().in('order_id', (await admin.from('sales_orders').select('id').eq('outlet_id', outletId)).data?.map((o) => o.id) ?? [])
  await admin.from('sales_orders').delete().eq('outlet_id', outletId)

  // Final safety net, scoped by company (this demo tenant has more than one
  // outlet — Outlet Utama and Cabang Bandung — so an outlet-scoped wipe
  // above can't be exhaustive for every products-referencing table): delete
  // any invoice_items still referencing this company's products before the
  // products delete, which would otherwise fail with a 23503 foreign key
  // violation regardless of which table left the stray reference.
  const { data: companyProducts } = await admin.from('products').select('id').eq('company_id', companyId)
  const companyProductIds = (companyProducts ?? []).map((p) => p.id)
  if (companyProductIds.length) {
    await admin.from('invoice_items').delete().in('product_id', companyProductIds)
  }

  const { error: productDeleteError } = await admin.from('products').delete().eq('company_id', companyId)
  if (productDeleteError) throw new Error(`products (delete): ${productDeleteError.message}`)
  await admin.from('product_categories').delete().eq('company_id', companyId)
  // Must come after product_categories: product_categories.department_id
  // has no ON DELETE action (RESTRICT), so a department row an
  // about-to-be-recreated category still points at would block this delete
  // if it ran first.
  await admin.from('product_departments').delete().eq('company_id', companyId)
  await admin.from('suppliers').delete().eq('company_id', companyId)

  // 3) Categories, suppliers, products, and starting inventory.
  const { data: categoryRows } = await admin
    .from('product_categories')
    .insert(DEMO_CATEGORIES.map((name) => ({ company_id: companyId, name })))
    .select('id, name')
  const categoryIdByName = new Map((categoryRows ?? []).map((c) => [c.name, c.id]))

  const { data: supplierRows } = await admin
    .from('suppliers')
    .insert(DEMO_SUPPLIERS.map((s) => ({ ...s, company_id: companyId })))
    .select('id')
  const supplierIds = (supplierRows ?? []).map((s) => s.id)

  const productInsert = DEMO_PRODUCTS.map((p, i) => ({
    company_id: companyId,
    category_id: categoryIdByName.get(p.category),
    supplier_id: supplierIds[i % supplierIds.length],
    sku: `DEMO-${String(i + 1).padStart(3, '0')}`,
    barcode: `899${String(1000000 + i).padStart(10, '0')}`,
    name: p.name,
    purchase_price: p.purchasePrice,
    selling_price: p.sellingPrice,
    unit_type: p.unitType,
    reorder_level: p.reorderLevel,
    reorder_quantity: p.reorderQuantity,
  }))
  const { data: productRows, error: productError } = await admin.from('products').insert(productInsert).select('id, name')
  if (productError || !productRows) {
    throw new Error(productError?.message ?? 'Gagal membuat produk demo')
  }

  const products = DEMO_PRODUCTS.map((p, i) => ({ ...p, id: productRows[i].id }))
  const stock = new Map(products.map((p) => [p.id, p.startingStock]))

  // 4) Schedule purchase orders across the period (restocks the lean-stock
  // items, and covers every PO status the UI can show).
  type ScheduledPO = { dayOffset: number; status: 'received' | 'ordered' | 'pending_approval' | 'draft'; items: { product: (typeof products)[number]; qty: number }[] }
  const poSchedule: ScheduledPO[] = []
  // Rendang/Udang are excluded from restocking on purpose — see the comment
  // in catalog.ts — so they deplete on schedule and show a real low-stock
  // alert "today" instead of every product doing so (an earlier version of
  // this seeder restocked too rarely for too few products and every item
  // hit zero stock simultaneously ~9 days before the end of the range,
  // leaving a dead gap with no recent transactions).
  const restockCandidates = products.filter((p) => !['Rendang Beku 500gr', 'Udang Windu Beku 500gr'].includes(p.name))
  for (let i = 0; i < 13; i++) {
    const dayOffset = 87 - i * 6.5 // roughly weekly, oldest first
    const items = Array.from({ length: randomInt(2, 4) }, () => {
      const product = weightedPickProduct(restockCandidates)
      return { product, qty: randomInt(40, 100) }
    })
    poSchedule.push({ dayOffset: Math.round(dayOffset), status: 'received', items })
  }
  poSchedule.push({ dayOffset: 5, status: 'ordered', items: [{ product: products.find((p) => p.name.includes('Udang'))!, qty: 60 }] })
  poSchedule.push({ dayOffset: 2, status: 'pending_approval', items: [{ product: products.find((p) => p.name.includes('Rendang'))!, qty: 50 }] })
  poSchedule.push({ dayOffset: 0, status: 'draft', items: [{ product: pick(products), qty: 40 }] })

  const today = new Date()
  function dateFor(dayOffset: number, hour = 12, minute = 0) {
    const d = new Date(today)
    d.setDate(d.getDate() - dayOffset)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  // 5) Simulate day by day (oldest -> newest) so restocks land before the
  // sales that depend on them, and stock never goes negative.
  interface GenInvoice {
    id: string
    outlet_id: string
    invoice_number: string
    customer_name: string | null
    customer_phone: string | null
    cashier_id: string
    subtotal: number
    discount_amount: number
    discount_reason: string | null
    tax_amount: number
    total: number
    payment_status: string
    order_status: string
    created_at: string
    voided_at?: string
    voided_by?: string
    void_reason?: string
  }
  interface GenItem {
    id: string
    invoice_id: string
    product_id: string
    quantity: number
    unit_price: number
    item_discount: number
    cost_of_goods_sold: number
  }
  interface GenPayment {
    id: string
    invoice_id: string
    payment_method: string
    amount: number
    status: string
    payment_date: string | null
    settlement_date: string | null
    settlement_amount: number | null
    created_at: string
  }
  interface GenLedger {
    outlet_id: string
    product_id: string
    movement_type: string
    quantity_change: number
    unit_cost: number | null
    reference_type: string
    reference_id: string | null
    recorded_by: string
    created_at: string
  }

  const invoices: GenInvoice[] = []
  const items: GenItem[] = []
  const payments: GenPayment[] = []
  const ledger: GenLedger[] = []
  const purchaseOrders: { id: string; outlet_id: string; supplier_id: string; po_number: string; status: string; order_date: string; actual_delivery_date: string | null; subtotal: number; total: number; created_by: string; approved_by: string | null }[] = []
  const poItemRows: { po_id: string; product_id: string; quantity_ordered: number; quantity_received: number; unit_cost: number }[] = []
  const purchaseInvoices: { id: string; po_id: string; supplier_id: string; invoice_number: string; invoice_date: string; due_date: string; subtotal: number; total: number; payment_status: string }[] = []
  const purchasePayments: { purchase_invoice_id: string; payment_date: string; amount: number; payment_method: string; recorded_by: string }[] = []

  let invoiceCounter = 0

  // Name -> phone, so invoices carry a real customer_phone instead of null.
  // Customer Summary Report matches by phone (no FK from invoices to
  // customers), so without this it would always show empty. Also doubles as
  // the seed data for the `customers` table itself (built further below).
  const customerPhoneByName = new Map(DEMO_CUSTOMER_NAMES.map((name, i) => [name, `0812345${String(60 + i).padStart(5, '0')}`]))

  for (let dayOffset = DAYS_OF_HISTORY - 1; dayOffset >= 0; dayOffset--) {
    const date = dateFor(dayOffset)
    const dayOfWeek = date.getDay()

    // Apply any PO receipts scheduled for this day before that day's sales.
    for (const po of poSchedule.filter((p) => p.dayOffset === dayOffset && p.status === 'received')) {
      const poId = crypto.randomUUID()
      const supplierId = pick(supplierIds)
      const poSubtotal = po.items.reduce((s, i) => s + i.qty * i.product.purchasePrice, 0)
      purchaseOrders.push({
        id: poId,
        outlet_id: outletId,
        supplier_id: supplierId,
        po_number: `PO-DEMO-${String(++invoiceCounter).padStart(4, '0')}`,
        status: 'received',
        order_date: dateFor(dayOffset + 2).toISOString().slice(0, 10),
        actual_delivery_date: date.toISOString().slice(0, 10),
        subtotal: poSubtotal,
        total: poSubtotal,
        created_by: userId,
        approved_by: userId,
      })
      for (const item of po.items) {
        poItemRows.push({ po_id: poId, product_id: item.product.id, quantity_ordered: item.qty, quantity_received: item.qty, unit_cost: item.product.purchasePrice })
        stock.set(item.product.id, (stock.get(item.product.id) ?? 0) + item.qty)
        ledger.push({
          outlet_id: outletId,
          product_id: item.product.id,
          movement_type: 'purchase',
          quantity_change: item.qty,
          unit_cost: item.product.purchasePrice,
          reference_type: 'purchase_order',
          reference_id: poId,
          recorded_by: userId,
          created_at: date.toISOString(),
        })
      }

      const purchaseInvoiceId = crypto.randomUUID()
      purchaseInvoices.push({
        id: purchaseInvoiceId,
        po_id: poId,
        supplier_id: supplierId,
        invoice_number: `SUPINV-${String(invoiceCounter).padStart(4, '0')}`,
        invoice_date: date.toISOString().slice(0, 10),
        due_date: dateFor(Math.max(dayOffset - 14, 0)).toISOString().slice(0, 10),
        subtotal: poSubtotal,
        total: poSubtotal,
        payment_status: 'paid',
      })
      purchasePayments.push({
        purchase_invoice_id: purchaseInvoiceId,
        payment_date: date.toISOString().slice(0, 10),
        amount: poSubtotal,
        payment_method: 'bank_transfer',
        recorded_by: userId,
      })
    }

    // Growth trend: busier in recent months than 3 months ago.
    const trendFactor = (DAYS_OF_HISTORY - dayOffset) / DAYS_OF_HISTORY
    const base = 4 + Math.round(trendFactor * 6)
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 2 : 0
    const txCount = Math.max(2, base + weekendBoost + randomInt(-1, 2))

    for (let t = 0; t < txCount; t++) {
      const lineCount = randomInt(1, 4)
      const chosen = new Set<string>()
      const lineItems: { product: (typeof products)[number]; qty: number }[] = []
      for (let l = 0; l < lineCount; l++) {
        const candidates = products.filter((p) => !chosen.has(p.id) && (stock.get(p.id) ?? 0) > 0)
        if (candidates.length === 0) break
        const product = weightedPickProduct(candidates)
        chosen.add(product.id)
        const available = stock.get(product.id) ?? 0
        const qty = randomInt(1, Math.min(5, available))
        lineItems.push({ product, qty })
        stock.set(product.id, available - qty)
      }
      if (lineItems.length === 0) continue

      const subtotal = lineItems.reduce((s, l) => s + l.qty * l.product.sellingPrice, 0)
      const hasDiscount = Math.random() < 0.1
      const discountAmount = hasDiscount ? Math.round(subtotal * 0.05) : 0
      const taxAmount = Math.round((subtotal - discountAmount) * TAX_RATE)
      const total = subtotal - discountAmount + taxAmount

      const paymentRoll = Math.random()
      const paymentMethod = paymentRoll < 0.55 ? 'cash' : paymentRoll < 0.85 ? 'e_wallet' : 'bank_transfer'
      const isRecent = dayOffset <= 2
      const isPending = paymentMethod !== 'cash' && isRecent && Math.random() < 0.2
      const paymentStatus = isPending ? 'pending' : 'paid'

      const invoiceId = crypto.randomUUID()
      const createdAt = dateFor(dayOffset, randomInt(8, 21), randomInt(0, 59))
      invoiceCounter++
      const invoiceCustomerName = Math.random() < 0.4 ? pick(DEMO_CUSTOMER_NAMES) : null

      invoices.push({
        id: invoiceId,
        outlet_id: outletId,
        invoice_number: `INV-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`,
        customer_name: invoiceCustomerName,
        customer_phone: invoiceCustomerName ? (customerPhoneByName.get(invoiceCustomerName) ?? null) : null,
        cashier_id: userId,
        subtotal,
        discount_amount: discountAmount,
        discount_reason: hasDiscount ? 'Promo pelanggan setia' : null,
        tax_amount: taxAmount,
        total,
        payment_status: paymentStatus,
        order_status: 'completed',
        created_at: createdAt.toISOString(),
      })

      for (const line of lineItems) {
        items.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          product_id: line.product.id,
          quantity: line.qty,
          unit_price: line.product.sellingPrice,
          item_discount: 0,
          cost_of_goods_sold: line.qty * line.product.purchasePrice,
        })
        ledger.push({
          outlet_id: outletId,
          product_id: line.product.id,
          movement_type: 'sales',
          quantity_change: -line.qty,
          unit_cost: line.product.purchasePrice,
          reference_type: 'invoice',
          reference_id: invoiceId,
          recorded_by: userId,
          created_at: createdAt.toISOString(),
        })
      }

      payments.push({
        id: crypto.randomUUID(),
        invoice_id: invoiceId,
        payment_method: paymentMethod,
        amount: total,
        status: isPending ? 'pending' : 'settled',
        payment_date: createdAt.toISOString(),
        settlement_date: isPending ? null : createdAt.toISOString(),
        settlement_amount: isPending ? null : total,
        created_at: createdAt.toISOString(),
      })
    }

    // The three non-"received" POs (ordered / pending_approval / draft).
    for (const po of poSchedule.filter((p) => p.dayOffset === dayOffset && p.status !== 'received')) {
      const poId = crypto.randomUUID()
      const poSubtotal = po.items.reduce((s, i) => s + i.qty * i.product.purchasePrice, 0)
      purchaseOrders.push({
        id: poId,
        outlet_id: outletId,
        supplier_id: pick(supplierIds),
        po_number: `PO-DEMO-${String(++invoiceCounter).padStart(4, '0')}`,
        status: po.status,
        order_date: date.toISOString().slice(0, 10),
        actual_delivery_date: null,
        subtotal: poSubtotal,
        total: poSubtotal,
        created_by: userId,
        approved_by: po.status === 'ordered' ? userId : null,
      })
      for (const item of po.items) {
        poItemRows.push({ po_id: poId, product_id: item.product.id, quantity_ordered: item.qty, quantity_received: 0, unit_cost: item.product.purchasePrice })
      }
    }
  }

  // 6) Void two recent invoices, restoring their stock and refunding payment.
  const voidable = invoices.filter((i) => new Date(i.created_at) > dateFor(4))
  const toVoid = voidable.slice(0, 2)
  const auditLogRows: { id: string; user_id: string; company_id: string; outlet_id: string; action_type: string; entity_type: string; entity_id: string; reason_for_action: string; status: string; created_at: string }[] = []

  for (const inv of toVoid) {
    inv.order_status = 'voided'
    const voidedAt = new Date(new Date(inv.created_at).getTime() + 45 * 60 * 1000)
    inv.voided_at = voidedAt.toISOString()
    inv.voided_by = userId
    inv.void_reason = 'Permintaan pembatalan oleh pelanggan'

    const invItems = items.filter((it) => it.invoice_id === inv.id)
    for (const it of invItems) {
      stock.set(it.product_id, (stock.get(it.product_id) ?? 0) + it.quantity)
      ledger.push({
        outlet_id: outletId,
        product_id: it.product_id,
        movement_type: 'return',
        quantity_change: it.quantity,
        unit_cost: null,
        reference_type: 'invoice_void',
        reference_id: inv.id,
        recorded_by: userId,
        created_at: voidedAt.toISOString(),
      })
    }
    const payment = payments.find((p) => p.invoice_id === inv.id)
    if (payment) payment.status = 'refunded'

    auditLogRows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      company_id: companyId,
      outlet_id: outletId,
      action_type: 'VOID',
      entity_type: 'invoice',
      entity_id: inv.id,
      reason_for_action: 'Permintaan pembatalan oleh pelanggan',
      status: 'success',
      created_at: voidedAt.toISOString(),
    })
  }

  // One manual stock adjustment example, for the audit log.
  const adjustProduct = pick(products)
  stock.set(adjustProduct.id, (stock.get(adjustProduct.id) ?? 0) + 10)
  ledger.push({
    outlet_id: outletId,
    product_id: adjustProduct.id,
    movement_type: 'adjustment',
    quantity_change: 10,
    unit_cost: null,
    reference_type: 'manual',
    reference_id: null,
    recorded_by: userId,
    created_at: dateFor(1).toISOString(),
  })
  auditLogRows.push({
    id: crypto.randomUUID(),
    user_id: userId,
    company_id: companyId,
    outlet_id: outletId,
    action_type: 'UPDATE',
    entity_type: 'inventory',
    entity_id: adjustProduct.id,
    reason_for_action: 'Koreksi hasil stok opname',
    status: 'success',
    created_at: dateFor(1).toISOString(),
  })

  // 6b) Feature-showcase data: everything below fills in the Phase 13 menus
  // that had zero demo data (or only a handful of leftover one-off test
  // rows from live-verifying them, not real history) — a fresh install of
  // this seeder gave a fully-populated POS/inventory/purchasing loop but a
  // mostly-empty Sales/Accounting sidebar otherwise. ~60 days of spread,
  // same dateFor/randomInt/pick helpers as the rest of this function.
  const customerRows = DEMO_CUSTOMER_NAMES.map((name) => ({
    id: crypto.randomUUID(),
    outlet_id: outletId,
    name,
    phone: customerPhoneByName.get(name)!,
    email: null as string | null,
    notes: null as string | null,
    created_by: userId,
    created_at: dateFor(randomInt(60, 89)).toISOString(),
  }))
  const departmentNames = ['Makanan Beku', 'Makanan Siap Saji', 'Bahan Segar']
  const departmentRows = departmentNames.map((name, i) => ({
    id: crypto.randomUUID(),
    company_id: companyId,
    name,
    sort_order: i,
  }))

  const notePresetLabels = ['Tanpa MSG', 'Extra Pedas', 'Tanpa Es', 'Less Sugar', 'Extra Sambal', 'Tanpa Bawang']
  const notePresetRows = notePresetLabels.map((label) => ({
    id: crypto.randomUUID(),
    outlet_id: outletId,
    label,
    is_active: true,
    created_by: userId,
    created_at: dateFor(randomInt(40, 89)).toISOString(),
  }))

  // Extra Product (modifiers): an unpriced "spice level" choice on a couple
  // of ready-to-eat items, plus one priced add-on linking a real product as
  // its own cart line (see ProductSearch.handleModifierConfirm).
  const modifierGroupRows: { id: string; product_id: string; name: string; sort_order: number }[] = []
  const modifierOptionRows: { id: string; group_id: string; label: string; linked_product_id: string | null; sort_order: number }[] = []
  const readyToEatProducts = products.filter((p) => p.category === 'Makanan Siap Saji')
  for (const mp of readyToEatProducts.slice(0, 2)) {
    const spiceGroupId = crypto.randomUUID()
    modifierGroupRows.push({ id: spiceGroupId, product_id: mp.id, name: 'Tingkat Kepedasan', sort_order: 0 })
    ;['Tidak Pedas', 'Sedang', 'Pedas'].forEach((label, i) =>
      modifierOptionRows.push({ id: crypto.randomUUID(), group_id: spiceGroupId, label, linked_product_id: null, sort_order: i })
    )
  }
  const sauceAddon = products.find((p) => p.name.includes('Saus'))
  if (sauceAddon && readyToEatProducts.length) {
    const addonGroupId = crypto.randomUUID()
    modifierGroupRows.push({ id: addonGroupId, product_id: readyToEatProducts[0].id, name: 'Tambahan', sort_order: 1 })
    modifierOptionRows.push({ id: crypto.randomUUID(), group_id: addonGroupId, label: sauceAddon.name, linked_product_id: sauceAddon.id, sort_order: 0 })
  }

  const customerFieldRows = ['Alamat Pengiriman', 'Tanggal Lahir'].map((label, i) => ({
    id: crypto.randomUUID(),
    outlet_id: outletId,
    label,
    sort_order: i,
    created_at: dateFor(randomInt(60, 89)).toISOString(),
  }))

  const reviewComments = [
    'Pelayanan cepat dan ramah, produk selalu segar.',
    'Harga bersaing dibanding toko sebelah.',
    'Stoknya kadang kurang lengkap untuk seafood.',
    'Puas belanja di sini, langganan terus.',
    'Antrian agak lama pas jam ramai.',
    'Kualitas daging bagus, packaging rapi.',
    'Respon kasir cepat dan sopan.',
    null,
  ]
  const customerReviewRows = Array.from({ length: 20 }, () => {
    const rating = weightedPickProduct([
      { v: 5, popularity: 5 },
      { v: 4, popularity: 4 },
      { v: 3, popularity: 2 },
      { v: 2, popularity: 1 },
      { v: 1, popularity: 1 },
    ]).v
    const name = pick(DEMO_CUSTOMER_NAMES)
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      invoice_id: null as string | null,
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      rating,
      comment: pick(reviewComments),
      created_by: userId,
      created_at: dateFor(randomInt(1, 59), randomInt(9, 20)).toISOString(),
    }
  })

  // Price Scheduler: 2 already-applied (new_price matches the product's
  // current catalog price, consistent with "this is the change that led to
  // today's price"), 2 still pending (future effective_date, so opening
  // /dashboard/sales/product/price-scheduler triggers the real
  // check-on-page-load apply instead of showing stale-already-done data).
  const priceScheduleRows: { id: string; product_id: string; new_price: number; effective_date: string; applied: boolean; created_by: string; created_at: string }[] = []
  for (const p of products.slice(0, 2)) {
    priceScheduleRows.push({
      id: crypto.randomUUID(),
      product_id: p.id,
      new_price: p.sellingPrice,
      effective_date: dateFor(randomInt(10, 30)).toISOString().slice(0, 10),
      applied: true,
      created_by: userId,
      created_at: dateFor(randomInt(31, 40)).toISOString(),
    })
  }
  for (const p of products.slice(2, 4)) {
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + randomInt(3, 10))
    priceScheduleRows.push({
      id: crypto.randomUUID(),
      product_id: p.id,
      new_price: Math.round((p.sellingPrice * 1.05) / 500) * 500,
      effective_date: futureDate.toISOString().slice(0, 10),
      applied: false,
      created_by: userId,
      created_at: dateFor(randomInt(1, 5)).toISOString(),
    })
  }

  // Time-Based Pricing: a lunch-hour discount on a couple of ready-to-eat
  // items, every day.
  const timeBasedPriceRows = readyToEatProducts.slice(0, 2).map((p) => ({
    id: crypto.randomUUID(),
    product_id: p.id,
    price: Math.round((p.sellingPrice * 0.85) / 500) * 500,
    day_of_week: null as number | null,
    start_time: '11:00',
    end_time: '14:00',
    is_active: true,
    created_by: userId,
    created_at: dateFor(randomInt(40, 89)).toISOString(),
  }))

  // Ojek Online Price List: a reference markup for the first 15 products
  // across all 3 real channels.
  const channelPriceRows: { id: string; product_id: string; channel: string; price: number; created_by: string; created_at: string }[] = []
  for (const p of products.slice(0, 15)) {
    for (const channel of ['gofood', 'grabfood', 'shopeefood']) {
      channelPriceRows.push({
        id: crypto.randomUUID(),
        product_id: p.id,
        channel,
        price: Math.round((p.sellingPrice * 1.08) / 500) * 500,
        created_by: userId,
        created_at: dateFor(randomInt(40, 89)).toISOString(),
      })
    }
  }

  // Product Deposits: spread across all 3 statuses.
  const productDepositRows = Array.from({ length: 15 }, (_, i) => {
    const product = weightedPickProduct(products)
    const qty = randomInt(2, 10)
    const statusRoll = Math.random()
    const status = statusRoll < 0.45 ? 'fulfilled' : statusRoll < 0.8 ? 'pending' : 'cancelled'
    const name = pick(DEMO_CUSTOMER_NAMES)
    const totalPrice = qty * product.sellingPrice
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      product_id: product.id,
      quantity: qty,
      deposit_amount: Math.round(totalPrice * 0.3),
      total_price: totalPrice,
      status,
      created_by: userId,
      created_at: dateFor(randomInt(i * 3, i * 3 + 3)).toISOString(),
    }
  })

  // Facility/Booking.
  const facilityRows = ['Ruang Pertemuan', 'Meja Diskusi A', 'Area Event Depan'].map((name, i) => ({
    id: crypto.randomUUID(),
    outlet_id: outletId,
    name,
    capacity: [10, 4, 30][i],
    description: null as string | null,
    is_active: true,
    created_by: userId,
    created_at: dateFor(randomInt(60, 89)).toISOString(),
  }))
  const bookingStatuses = ['pending', 'confirmed', 'completed', 'completed', 'cancelled']
  const bookingRows = Array.from({ length: 20 }, () => {
    const dayOffset = randomInt(0, 59)
    const name = pick(DEMO_CUSTOMER_NAMES)
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      item_description: 'Sewa ruang/area untuk acara kecil',
      staff_id: null as string | null,
      facility_id: pick(facilityRows).id,
      scheduled_date: dateFor(dayOffset).toISOString().slice(0, 10),
      scheduled_start_time: `${randomInt(8, 18)}:00`,
      scheduled_end_time: `${randomInt(8, 18)}:00`,
      status: dayOffset > 2 ? pick(bookingStatuses) : pick(['pending', 'confirmed']),
      notes: null as string | null,
      created_by: userId,
      created_at: dateFor(dayOffset + randomInt(1, 5)).toISOString(),
    }
  })

  // Sales Documents: quotations, orders, deliveries — a mix of statuses,
  // some quotations converted through to a real invoice/order so "Convert
  // to Invoice"/"Fulfill" have something to show as already-done.
  const quotationStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired']
  const salesQuotationRows: { id: string; outlet_id: string; customer_name: string; customer_phone: string | null; quotation_number: string; quotation_date: string; valid_until: string; status: string; invoice_id: string | null; notes: null; created_by: string; created_at: string }[] = []
  const salesQuotationItemRows: { quotation_id: string; product_id: string; quantity: number; unit_price: number }[] = []
  const convertibleInvoices = invoices.filter((i) => i.order_status === 'completed')
  for (let i = 0; i < 15; i++) {
    const dayOffset = randomInt(1, 59)
    const status = i < 3 ? 'accepted' : pick(quotationStatuses)
    const name = pick(DEMO_CUSTOMER_NAMES)
    const quotationId = crypto.randomUUID()
    const lineItems = Array.from({ length: randomInt(1, 3) }, () => ({ product: weightedPickProduct(products), qty: randomInt(2, 8) }))
    salesQuotationRows.push({
      id: quotationId,
      outlet_id: outletId,
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      quotation_number: `QUO-DEMO-${String(i + 1).padStart(4, '0')}`,
      quotation_date: dateFor(dayOffset).toISOString().slice(0, 10),
      valid_until: dateFor(Math.max(0, dayOffset - 14)).toISOString().slice(0, 10),
      status,
      invoice_id: status === 'accepted' && convertibleInvoices[i] ? convertibleInvoices[i].id : null,
      notes: null,
      created_by: userId,
      created_at: dateFor(dayOffset).toISOString(),
    })
    for (const line of lineItems) {
      salesQuotationItemRows.push({ quotation_id: quotationId, product_id: line.product.id, quantity: line.qty, unit_price: line.product.sellingPrice })
    }
  }

  const orderStatuses = ['draft', 'confirmed', 'fulfilled', 'cancelled']
  const salesOrderRows: { id: string; outlet_id: string; customer_name: string; customer_phone: string | null; order_number: string; order_date: string; quotation_id: string | null; status: string; invoice_id: string | null; notes: null; created_by: string; created_at: string }[] = []
  const salesOrderItemRows: { order_id: string; product_id: string; quantity: number; unit_price: number }[] = []
  for (let i = 0; i < 10; i++) {
    const dayOffset = randomInt(1, 59)
    const status = i < 3 ? 'fulfilled' : pick(orderStatuses)
    const name = pick(DEMO_CUSTOMER_NAMES)
    const orderId = crypto.randomUUID()
    const lineItems = Array.from({ length: randomInt(1, 3) }, () => ({ product: weightedPickProduct(products), qty: randomInt(2, 8) }))
    salesOrderRows.push({
      id: orderId,
      outlet_id: outletId,
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      order_number: `SO-DEMO-${String(i + 1).padStart(4, '0')}`,
      order_date: dateFor(dayOffset).toISOString().slice(0, 10),
      quotation_id: null,
      status,
      invoice_id: status === 'fulfilled' && convertibleInvoices[i + 15] ? convertibleInvoices[i + 15].id : null,
      notes: null,
      created_by: userId,
      created_at: dateFor(dayOffset).toISOString(),
    })
    for (const line of lineItems) {
      salesOrderItemRows.push({ order_id: orderId, product_id: line.product.id, quantity: line.qty, unit_price: line.product.sellingPrice })
    }
  }

  const deliveryStatuses = ['preparing', 'shipped', 'delivered', 'delivered']
  const salesDeliveryRows = convertibleInvoices.slice(20, 28).map((inv) => {
    const status = pick(deliveryStatuses)
    return {
      id: crypto.randomUUID(),
      invoice_id: inv.id,
      courier_name: pick(['JNE', 'J&T Express', 'SiCepat', 'Kurir Toko']),
      tracking_number: status === 'preparing' ? null : `TRK${randomInt(100000, 999999)}`,
      status,
      shipped_at: status === 'preparing' ? null : new Date(new Date(inv.created_at).getTime() + 3600_000).toISOString(),
      delivered_at: status === 'delivered' ? new Date(new Date(inv.created_at).getTime() + 2 * 86400_000).toISOString() : null,
      notes: null as string | null,
      created_by: userId,
      created_at: inv.created_at,
    }
  })

  // Purchase Return Reconciliation: linked back to a real purchase_invoice
  // where one exists, so "berapa yang masih harus dibayar setelah retur"
  // has real numbers to show.
  const purchaseReturnRows: { id: string; outlet_id: string; supplier_id: string; po_id: string | null; purchase_invoice_id: string | null; return_date: string; reason: string; status: string; total_amount: number; created_by: string; created_at: string }[] = []
  const purchaseReturnItemRows: { return_id: string; product_id: string; quantity: number; unit_cost: number }[] = []
  const returnableInvoices = purchaseInvoices.slice(0, 6)
  for (const pinv of returnableInvoices) {
    const po = purchaseOrders.find((p) => p.id === pinv.po_id)
    const poItems = poItemRows.filter((it) => it.po_id === pinv.po_id)
    if (!po || poItems.length === 0) continue
    const line = pick(poItems)
    const qty = Math.min(line.quantity_received || 1, randomInt(1, 5))
    const returnId = crypto.randomUUID()
    purchaseReturnRows.push({
      id: returnId,
      outlet_id: outletId,
      supplier_id: po.supplier_id,
      po_id: po.id,
      purchase_invoice_id: pinv.id,
      return_date: pinv.invoice_date,
      reason: pick(['Barang rusak saat pengiriman', 'Kualitas tidak sesuai', 'Kelebihan kirim', 'Kemasan penyok']),
      status: 'completed',
      total_amount: qty * line.unit_cost,
      created_by: userId,
      created_at: pinv.invoice_date,
    })
    purchaseReturnItemRows.push({ return_id: returnId, product_id: line.product_id, quantity: qty, unit_cost: line.unit_cost })
  }

  // Recipes: a couple of prepared items made from raw ingredients, plus a
  // scheduled ingredient change (one already applied, one still pending —
  // same check-on-page-load pattern as Price Scheduler).
  const recipeRows: { id: string; outlet_id: string; name: string; output_product_id: string; output_quantity: number; created_by: string; created_at: string }[] = []
  const recipeIngredientRows: { recipe_id: string; ingredient_product_id: string; quantity: number }[] = []
  const recipeChangeScheduleRows: { id: string; recipe_id: string; new_ingredients: { ingredient_product_id: string; quantity: number }[]; effective_date: string; applied: boolean; created_by: string; created_at: string }[] = []
  const recipeCandidates = readyToEatProducts.slice(0, 3)
  for (const output of recipeCandidates) {
    const ingredients = products.filter((p) => p.id !== output.id && p.category !== 'Makanan Siap Saji').slice(0, 2)
    if (ingredients.length < 1) continue
    const recipeId = crypto.randomUUID()
    recipeRows.push({
      id: recipeId,
      outlet_id: outletId,
      name: `Resep ${output.name}`,
      output_product_id: output.id,
      output_quantity: 1,
      created_by: userId,
      created_at: dateFor(randomInt(60, 89)).toISOString(),
    })
    for (const ing of ingredients) {
      recipeIngredientRows.push({ recipe_id: recipeId, ingredient_product_id: ing.id, quantity: randomInt(1, 3) })
    }
    if (recipeRows.length === 1 && ingredients.length) {
      recipeChangeScheduleRows.push({
        id: crypto.randomUUID(),
        recipe_id: recipeId,
        new_ingredients: ingredients.map((ing) => ({ ingredient_product_id: ing.id, quantity: randomInt(1, 3) })),
        effective_date: dateFor(20).toISOString().slice(0, 10),
        applied: true,
        created_by: userId,
        created_at: dateFor(25).toISOString(),
      })
    }
    if (recipeRows.length === 2 && ingredients.length) {
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + 7)
      recipeChangeScheduleRows.push({
        id: crypto.randomUUID(),
        recipe_id: recipeId,
        new_ingredients: ingredients.slice().reverse().map((ing) => ({ ingredient_product_id: ing.id, quantity: randomInt(1, 3) })),
        effective_date: futureDate.toISOString().slice(0, 10),
        applied: false,
        created_by: userId,
        created_at: dateFor(2).toISOString(),
      })
    }
  }

  // Promo & Loyalty: coupons with real usage_count, plus a loyalty ledger
  // (points earned roughly tracking each customer's actual spend, with a
  // few redemptions) for the customers created above.
  const couponRows = [
    { code: 'HEMAT10', discount_type: 'percentage', discount_value: 10, usage_limit: 100, usage_count: 34, expires_at: null as string | null, is_active: true },
    { code: 'DISKON5K', discount_type: 'fixed', discount_value: 5000, usage_limit: 200, usage_count: 87, expires_at: null, is_active: true },
    { code: 'AKHIRTAHUN', discount_type: 'percentage', discount_value: 15, usage_limit: 50, usage_count: 50, expires_at: dateFor(30).toISOString().slice(0, 10), is_active: false },
    { code: 'NEWCUST', discount_type: 'fixed', discount_value: 10000, usage_limit: 30, usage_count: 12, expires_at: null, is_active: true },
    { code: 'WEEKEND', discount_type: 'percentage', discount_value: 8, usage_limit: null as number | null, usage_count: 21, expires_at: null, is_active: true },
  ].map((c) => ({ id: crypto.randomUUID(), outlet_id: outletId, ...c, created_by: userId, created_at: dateFor(randomInt(50, 89)).toISOString() }))

  const loyaltyLedgerRows: { customer_id: string; points_change: number; reason: string; recorded_by: string; created_at: string }[] = []
  for (const c of customerRows) {
    const earnEvents = randomInt(2, 5)
    for (let e = 0; e < earnEvents; e++) {
      loyaltyLedgerRows.push({
        customer_id: c.id,
        points_change: randomInt(5, 40),
        reason: 'Poin dari transaksi pembelian',
        recorded_by: userId,
        created_at: dateFor(randomInt(1, 59)).toISOString(),
      })
    }
    if (Math.random() < 0.4) {
      loyaltyLedgerRows.push({
        customer_id: c.id,
        points_change: -randomInt(10, 30),
        reason: 'Penukaran poin untuk diskon',
        recorded_by: userId,
        created_at: dateFor(randomInt(1, 30)).toISOString(),
      })
    }
  }

  // Stock Transfer, between Outlet Utama and whichever other outlet this
  // company has (the demo tenant has a "Cabang Bandung" second outlet).
  const { data: otherOutlets } = await admin.from('outlets').select('id').eq('company_id', companyId).neq('id', outletId)
  const otherOutletId = otherOutlets?.[0]?.id ?? null
  const stockTransferRows: { id: string; company_id: string; source_outlet_id: string; destination_outlet_id: string; status: string; notes: null; requested_by: string; shipped_by: string | null; received_by: string | null; shipped_at: string | null; received_at: string | null; created_at: string }[] = []
  const stockTransferItemRows: { transfer_id: string; product_id: string; quantity: number }[] = []
  if (otherOutletId) {
    const transferStatuses = ['requested', 'in_transit', 'completed', 'completed', 'cancelled']
    for (let i = 0; i < 5; i++) {
      const dayOffset = randomInt(1, 59)
      const status = transferStatuses[i] ?? pick(transferStatuses)
      const transferId = crypto.randomUUID()
      stockTransferRows.push({
        id: transferId,
        company_id: companyId,
        source_outlet_id: outletId,
        destination_outlet_id: otherOutletId,
        status,
        notes: null,
        requested_by: userId,
        shipped_by: status === 'requested' ? null : userId,
        received_by: status === 'completed' ? userId : null,
        shipped_at: status === 'requested' ? null : dateFor(dayOffset - 1).toISOString(),
        received_at: status === 'completed' ? dateFor(dayOffset - 2).toISOString() : null,
        created_at: dateFor(dayOffset).toISOString(),
      })
      for (const p of Array.from({ length: randomInt(1, 3) }, () => weightedPickProduct(products))) {
        stockTransferItemRows.push({ transfer_id: transferId, product_id: p.id, quantity: randomInt(5, 20) })
      }
    }
  }

  // Stocktake, across statuses, with a couple of counted lines each (one
  // with a deliberate variance so the report has something to flag).
  const stocktakeStatuses = ['completed', 'approved', 'in_progress']
  const stocktakeRows = stocktakeStatuses.map((status, i) => ({
    id: crypto.randomUUID(),
    outlet_id: outletId,
    scheduled_date: dateFor(20 - i * 7).toISOString().slice(0, 10),
    actual_start_date: status === 'in_progress' ? dateFor(0).toISOString() : dateFor(20 - i * 7).toISOString(),
    actual_end_date: status === 'in_progress' ? null : dateFor(20 - i * 7).toISOString(),
    created_by: userId,
    approved_by: status === 'approved' ? userId : null,
    status,
    variance_tolerance_percent: 2.0,
    total_variance_value: null as number | null,
    notes: null as string | null,
    created_at: dateFor(20 - i * 7).toISOString(),
  }))
  const stocktakeDetailRows: { stocktake_id: string; product_id: string; expected_quantity: number; counted_quantity: number }[] = []
  for (const st of stocktakeRows) {
    for (const p of products.slice(0, 4)) {
      const expected = stock.get(p.id) ?? 20
      const variance = st.status === 'in_progress' ? 0 : pick([0, 0, 0, -1, 1, -2])
      stocktakeDetailRows.push({ stocktake_id: st.id, product_id: p.id, expected_quantity: expected, counted_quantity: Math.max(0, expected + variance) })
    }
  }

  // Buy Marketing Campaign, Petty Cash expenses, and manual online orders —
  // more of what Phase 13 Batches I/E/F already built, spread across the
  // same ~60 days instead of a handful of leftover verification rows.
  const campaignPlatforms = ['meta', 'google', 'tiktok', 'other']
  const campaignStatuses = ['pending', 'approved', 'approved', 'rejected', 'completed']
  const campaignRequestRows = Array.from({ length: 10 }, (_, i) => {
    const dayOffset = randomInt(1, 59)
    const status = campaignStatuses[i % campaignStatuses.length]
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      campaign_name: pick(['Promo Akhir Pekan', 'Iklan Produk Baru', 'Boost Brand Awareness', 'Campaign Ramadan', 'Retargeting Pelanggan']),
      platform: pick(campaignPlatforms),
      budget_amount: randomInt(5, 30) * 100000,
      notes: null as string | null,
      requested_by: userId,
      status,
      approved_by: status === 'pending' ? null : userId,
      decided_at: status === 'pending' ? null : dateFor(Math.max(0, dayOffset - 1)).toISOString(),
      created_at: dateFor(dayOffset).toISOString(),
    }
  })

  const expenseStatuses = ['pending', 'approved', 'approved', 'rejected']
  const expenseRequestRows = Array.from({ length: 12 }, (_, i) => {
    const dayOffset = randomInt(1, 59)
    const status = expenseStatuses[i % expenseStatuses.length]
    const paid = status === 'approved' && Math.random() < 0.6
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      description: pick(['Beli perlengkapan kebersihan', 'Servis AC toko', 'Biaya parkir supplier', 'Beli ATK', 'Ganti lampu gudang', 'Biaya listrik tambahan']),
      amount: randomInt(5, 50) * 10000,
      requested_by: userId,
      status,
      approved_by: status === 'pending' ? null : userId,
      decided_at: status === 'pending' ? null : dateFor(Math.max(0, dayOffset - 1)).toISOString(),
      paid_at: paid ? dateFor(Math.max(0, dayOffset - 2)).toISOString() : null,
      payment_method: paid ? pick(['cash', 'bank_transfer']) : null,
      created_at: dateFor(dayOffset).toISOString(),
    }
  })

  const onlineOrderChannels = ['whatsapp', 'instagram', 'marketplace', 'other']
  const onlineOrderStatuses = ['incoming', 'on_process', 'on_delivery', 'completed', 'completed', 'cancelled']
  const onlineOrderRows = Array.from({ length: 20 }, (_, i) => {
    const dayOffset = randomInt(1, 59)
    const lineItems = Array.from({ length: randomInt(1, 3) }, () => {
      const product = weightedPickProduct(products)
      const qty = randomInt(1, 4)
      return { name: product.name, quantity: qty, price: product.sellingPrice }
    })
    const total = lineItems.reduce((s, l) => s + l.quantity * l.price, 0)
    const name = pick(DEMO_CUSTOMER_NAMES)
    return {
      id: crypto.randomUUID(),
      outlet_id: outletId,
      order_number: `OL-DEMO-${String(i + 1).padStart(4, '0')}`,
      channel: pick(onlineOrderChannels),
      customer_name: name,
      customer_phone: customerPhoneByName.get(name) ?? null,
      items: lineItems,
      total_amount: total,
      status: dayOffset > 2 ? pick(onlineOrderStatuses) : pick(['incoming', 'on_process']),
      notes: null as string | null,
      created_by: userId,
      created_at: dateFor(dayOffset).toISOString(),
    }
  })

  // 7) Final inventory rows + low-stock alerts.
  const inventoryRows = products.map((p) => {
    const qty = Math.max(0, stock.get(p.id) ?? 0)
    const alertStatus = qty <= 0 ? 'out_of_stock' : qty <= p.reorderLevel ? 'low_stock' : 'normal'
    return { outlet_id: outletId, product_id: p.id, quantity_on_hand: qty, alert_status: alertStatus, reorder_level: p.reorderLevel }
  })
  const systemAlertRows = inventoryRows
    .filter((r) => r.alert_status !== 'normal')
    .map((r) => {
      const product = products.find((p) => p.id === r.product_id)!
      return {
        outlet_id: outletId,
        alert_type: r.alert_status,
        severity: r.alert_status === 'out_of_stock' ? 'critical' : 'warning',
        title: r.alert_status === 'out_of_stock' ? `${product.name} habis` : `Stok ${product.name} menipis`,
        description: `Sisa stok: ${r.quantity_on_hand} (batas reorder: ${product.reorderLevel})`,
        reference_entity_type: 'product',
        reference_entity_id: product.id,
      }
    })

  // 8) Write everything, in dependency order, chunked to keep payloads small.
  async function insertChunked<T>(table: keyof Database['public']['Tables'], rows: T[], chunkSize = 300) {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + chunkSize) as never)
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }

  await insertChunked('inventory', inventoryRows)
  await insertChunked('invoices', invoices)
  await insertChunked('invoice_items', items)
  await insertChunked('payment_transactions', payments)
  await insertChunked('inventory_ledger', ledger)
  await insertChunked('purchase_orders', purchaseOrders)
  await insertChunked('po_items', poItemRows)
  await insertChunked('purchase_invoices', purchaseInvoices)
  await insertChunked('purchase_payments', purchasePayments)
  if (systemAlertRows.length) await insertChunked('system_alerts', systemAlertRows)
  if (auditLogRows.length) await insertChunked('audit_log', auditLogRows)

  // Feature-showcase data (6b, above) — same dependency-order chunked
  // writes, covering the Phase 13 menus that otherwise had nothing to show.
  await insertChunked('customers', customerRows)
  await insertChunked('product_departments', departmentRows)
  // A couple of categories grouped under a department, so the department
  // filter on the categories list has something to actually group.
  const groupableCategoryNames = ['Makanan Siap Saji', 'Es Krim & Dessert']
  for (const [i, name] of groupableCategoryNames.entries()) {
    const catId = categoryIdByName.get(name)
    if (catId) await admin.from('product_categories').update({ department_id: departmentRows[i % departmentRows.length].id }).eq('id', catId)
  }
  await insertChunked('note_presets', notePresetRows)
  await insertChunked('product_modifier_groups', modifierGroupRows)
  if (modifierOptionRows.length) await insertChunked('product_modifier_options', modifierOptionRows)
  await insertChunked('customer_field_definitions', customerFieldRows)
  await insertChunked('customer_reviews', customerReviewRows)
  await insertChunked('price_schedules', priceScheduleRows)
  await insertChunked('time_based_prices', timeBasedPriceRows)
  await insertChunked('channel_prices', channelPriceRows)
  await insertChunked('product_deposits', productDepositRows)
  await insertChunked('facilities', facilityRows)
  await insertChunked('bookings', bookingRows)
  await insertChunked('sales_quotations', salesQuotationRows)
  if (salesQuotationItemRows.length) await insertChunked('sales_quotation_items', salesQuotationItemRows)
  await insertChunked('sales_orders', salesOrderRows)
  if (salesOrderItemRows.length) await insertChunked('sales_order_items', salesOrderItemRows)
  if (salesDeliveryRows.length) await insertChunked('sales_deliveries', salesDeliveryRows)
  if (purchaseReturnRows.length) await insertChunked('purchase_returns', purchaseReturnRows)
  if (purchaseReturnItemRows.length) await insertChunked('purchase_return_items', purchaseReturnItemRows)
  await insertChunked('recipes', recipeRows)
  if (recipeIngredientRows.length) await insertChunked('recipe_ingredients', recipeIngredientRows)
  if (recipeChangeScheduleRows.length) await insertChunked('recipe_change_schedules', recipeChangeScheduleRows)
  await insertChunked('coupons', couponRows)
  if (loyaltyLedgerRows.length) await insertChunked('loyalty_ledger', loyaltyLedgerRows)
  if (stockTransferRows.length) await insertChunked('stock_transfers', stockTransferRows)
  if (stockTransferItemRows.length) await insertChunked('stock_transfer_items', stockTransferItemRows)
  await insertChunked('stocktakes', stocktakeRows)
  if (stocktakeDetailRows.length) await insertChunked('stocktake_details', stocktakeDetailRows)
  await insertChunked('campaign_requests', campaignRequestRows)
  await insertChunked('expense_requests', expenseRequestRows)
  await insertChunked('online_orders', onlineOrderRows)

  return {
    products: products.length,
    invoices: invoices.length,
    purchase_orders: purchaseOrders.length,
    days_of_history: DAYS_OF_HISTORY,
    customers: customerRows.length,
    bookings: bookingRows.length,
    sales_quotations: salesQuotationRows.length,
    sales_orders: salesOrderRows.length,
    recipes: recipeRows.length,
    coupons: couponRows.length,
    campaign_requests: campaignRequestRows.length,
    expense_requests: expenseRequestRows.length,
    online_orders: onlineOrderRows.length,
    outlets: 1 + (await seedSecondaryOutlets(admin, companyId, products, DEFAULT_COA)),
  }
}

// Default chart of accounts, same 14 rows provision_company_and_owner()
// (014_accounting_functions.sql) seeds for a freshly-registered company's
// first outlet. Outlets added here are created directly (not through that
// RPC), so they'd otherwise have no accounts at all and 059_auto_post_
// journal_entries.sql's triggers would silently skip every sale (their
// account lookups return null, which they're designed to no-op on rather
// than fail) — every other outlet's books would just look empty.
const DEFAULT_COA: [string, string, string][] = [
  ['1000', 'Kas', 'asset'],
  ['1010', 'Bank', 'asset'],
  ['1100', 'Piutang Usaha', 'asset'],
  ['1200', 'Persediaan Barang Dagang', 'asset'],
  ['2000', 'Utang Usaha', 'liability'],
  ['2100', 'Utang Pajak', 'liability'],
  ['3000', 'Modal Pemilik', 'equity'],
  ['3100', 'Laba Ditahan', 'equity'],
  ['4000', 'Pendapatan Penjualan', 'income'],
  ['4100', 'Pendapatan Lain-lain', 'income'],
  ['5000', 'Harga Pokok Penjualan', 'expense'],
  ['5100', 'Beban Gaji', 'expense'],
  ['5200', 'Beban Operasional', 'expense'],
  ['5300', 'Beban Sewa', 'expense'],
]

const SECONDARY_OUTLET_SPECS = [
  { name: 'Toko Frozen Fresh Demo - Cabang Bandung', city: 'Bandung', managerEmail: 'manager-bandung@gaweee.app', managerName: 'Manajer Cabang Bandung' },
  { name: 'Toko Frozen Fresh Demo - Cabang Surabaya', city: 'Surabaya', managerEmail: 'manager-surabaya@gaweee.app', managerName: 'Manajer Cabang Surabaya' },
  { name: 'Toko Frozen Fresh Demo - Cabang Medan', city: 'Medan', managerEmail: 'manager-medan@gaweee.app', managerName: 'Manajer Cabang Medan' },
  { name: 'Toko Frozen Fresh Demo - Cabang Yogyakarta', city: 'Yogyakarta', managerEmail: 'manager-yogyakarta@gaweee.app', managerName: 'Manajer Cabang Yogyakarta' },
]
const SECONDARY_OUTLET_DAYS = 21

/** Ensures the demo company has 5 outlets total (1 primary + 4 branches,
 * see SECONDARY_OUTLET_SPECS) and gives each branch ~3 weeks of its own
 * lighter sales history — real numbers for the multi-outlet monitoring
 * dashboard (/dashboard/admin/outlets: per-outlet + company-wide totals,
 * both already outlet_id-generic — they just needed more than one outlet
 * with data to actually demonstrate) to show, including a realistic
 * lunch/dinner-peaked hourly pattern for the Hourly view. Lighter than the
 * primary outlet's full 90-day, every-feature history on purpose: the ask
 * here is branch-level revenue/margin/hourly monitoring, not re-exercising
 * every POS feature per branch. Returns how many branch outlets were
 * touched. */
async function seedSecondaryOutlets(
  admin: SupabaseClient<Database>,
  companyId: string,
  products: { id: string; purchasePrice: number; sellingPrice: number; popularity: number }[],
  defaultCoa: [string, string, string][]
) {
  const today = new Date()
  function dateFor(dayOffset: number, hour = 12, minute = 0) {
    const d = new Date(today)
    d.setDate(d.getDate() - dayOffset)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  // Lunch (12-13) and dinner (18-19) get roughly 3x the weight of an
  // ordinary open hour, closed hours (before 8, after 21) get none — a
  // believable retail pattern for the Hourly chart instead of flat noise.
  function pickBusinessHour() {
    const weights: [number, number][] = []
    for (let h = 8; h <= 21; h++) weights.push([h, h === 12 || h === 13 || h === 18 || h === 19 ? 3 : 1])
    const total = weights.reduce((s, [, w]) => s + w, 0)
    let r = Math.random() * total
    for (const [h, w] of weights) {
      r -= w
      if (r <= 0) return h
    }
    return 12
  }

  for (const spec of SECONDARY_OUTLET_SPECS) {
    let outletId: string
    const { data: existing } = await admin.from('outlets').select('id').eq('company_id', companyId).eq('name', spec.name).maybeSingle()
    if (existing) {
      outletId = existing.id
    } else {
      const { data: created, error } = await admin
        .from('outlets')
        .insert({ company_id: companyId, name: spec.name, address: '-', city: spec.city })
        .select('id')
        .single()
      if (error || !created) throw new Error(`secondary outlet (${spec.name}): ${error?.message}`)
      outletId = created.id
    }

    const { count: coaCount } = await admin.from('chart_of_accounts').select('*', { count: 'exact', head: true }).eq('outlet_id', outletId)
    if (!coaCount) {
      await admin
        .from('chart_of_accounts')
        .insert(defaultCoa.map(([account_code, account_name, account_type]) => ({ outlet_id: outletId, account_code, account_name, account_type })))
    }

    let managerId: string
    const { data: existingManager } = await admin.from('users').select('id').eq('email', spec.managerEmail).maybeSingle()
    if (existingManager) {
      managerId = existingManager.id
      await admin.from('users').update({ outlet_id: outletId }).eq('id', managerId)
    } else {
      const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
        email: spec.managerEmail,
        password: 'DemoManager2026!',
        email_confirm: true,
      })
      if (authError || !createdAuth.user) throw new Error(`secondary outlet manager (${spec.managerEmail}): ${authError?.message}`)
      managerId = createdAuth.user.id
      await admin
        .from('users')
        .insert({ id: managerId, company_id: companyId, outlet_id: outletId, email: spec.managerEmail, full_name: spec.managerName, role: 'outlet_manager' })
    }

    // Reset this branch's own history (outlet-scoped, FK-safe order) —
    // matches the primary outlet's reseed idempotency so repeated demo
    // resets don't just keep piling on more invoices forever.
    const branchInvoiceIds = (await admin.from('invoices').select('id').eq('outlet_id', outletId)).data?.map((i) => i.id) ?? []
    if (branchInvoiceIds.length) {
      await admin.from('payment_transactions').delete().in('invoice_id', branchInvoiceIds)
      await admin.from('invoice_items').delete().in('invoice_id', branchInvoiceIds)
    }
    await admin.from('journal_entries').delete().eq('outlet_id', outletId)
    await admin.from('invoices').delete().eq('outlet_id', outletId)
    await admin.from('inventory_ledger').delete().eq('outlet_id', outletId)
    await admin.from('inventory').delete().eq('outlet_id', outletId)

    const stock = new Map(products.map((p) => [p.id, 200]))
    const branchInvoices: { id: string; outlet_id: string; invoice_number: string; customer_name: null; customer_phone: null; cashier_id: string; subtotal: number; discount_amount: number; discount_reason: null; tax_amount: number; total: number; payment_status: string; order_status: string; created_at: string }[] = []
    const branchItems: { id: string; invoice_id: string; product_id: string; quantity: number; unit_price: number; item_discount: number; cost_of_goods_sold: number }[] = []
    const branchPayments: { id: string; invoice_id: string; payment_method: string; amount: number; status: string; payment_date: string; settlement_date: string; settlement_amount: number; created_at: string }[] = []
    const branchLedger: { outlet_id: string; product_id: string; movement_type: string; quantity_change: number; unit_cost: number; reference_type: string; reference_id: string; recorded_by: string; created_at: string }[] = []

    let counter = 0
    for (let dayOffset = SECONDARY_OUTLET_DAYS - 1; dayOffset >= 0; dayOffset--) {
      const txCount = randomInt(3, 10)
      for (let t = 0; t < txCount; t++) {
        const lineCount = randomInt(1, 3)
        const lineItems: { product: (typeof products)[number]; qty: number }[] = []
        const chosen = new Set<string>()
        for (let l = 0; l < lineCount; l++) {
          const candidates = products.filter((p) => !chosen.has(p.id) && (stock.get(p.id) ?? 0) > 0)
          if (!candidates.length) break
          const product = weightedPickProduct(candidates)
          chosen.add(product.id)
          const available = stock.get(product.id) ?? 0
          const qty = randomInt(1, Math.min(5, available))
          lineItems.push({ product, qty })
          stock.set(product.id, available - qty)
        }
        if (!lineItems.length) continue

        const subtotal = lineItems.reduce((s, l) => s + l.qty * l.product.sellingPrice, 0)
        const taxAmount = Math.round(subtotal * TAX_RATE)
        const total = subtotal + taxAmount
        const paymentMethod = pick(['cash', 'cash', 'e_wallet', 'bank_transfer'])
        const createdAt = dateFor(dayOffset, pickBusinessHour(), randomInt(0, 59))
        const invoiceId = crypto.randomUUID()
        counter++

        branchInvoices.push({
          id: invoiceId,
          outlet_id: outletId,
          invoice_number: `INV-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${spec.city.slice(0, 3).toUpperCase()}${String(counter).padStart(4, '0')}`,
          customer_name: null,
          customer_phone: null,
          cashier_id: managerId,
          subtotal,
          discount_amount: 0,
          discount_reason: null,
          tax_amount: taxAmount,
          total,
          payment_status: 'paid',
          order_status: 'completed',
          created_at: createdAt.toISOString(),
        })
        for (const line of lineItems) {
          branchItems.push({
            id: crypto.randomUUID(),
            invoice_id: invoiceId,
            product_id: line.product.id,
            quantity: line.qty,
            unit_price: line.product.sellingPrice,
            item_discount: 0,
            cost_of_goods_sold: line.qty * line.product.purchasePrice,
          })
          branchLedger.push({
            outlet_id: outletId,
            product_id: line.product.id,
            movement_type: 'sales',
            quantity_change: -line.qty,
            unit_cost: line.product.purchasePrice,
            reference_type: 'invoice',
            reference_id: invoiceId,
            recorded_by: managerId,
            created_at: createdAt.toISOString(),
          })
        }
        branchPayments.push({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          payment_method: paymentMethod,
          amount: total,
          status: 'settled',
          payment_date: createdAt.toISOString(),
          settlement_date: createdAt.toISOString(),
          settlement_amount: total,
          created_at: createdAt.toISOString(),
        })
      }
    }

    const branchInventory = products.map((p) => ({
      outlet_id: outletId,
      product_id: p.id,
      quantity_on_hand: Math.max(0, stock.get(p.id) ?? 0),
      alert_status: (stock.get(p.id) ?? 0) <= 0 ? 'out_of_stock' : (stock.get(p.id) ?? 0) <= 10 ? 'low_stock' : 'normal',
    }))

    async function insertChunkedBranch<T>(table: keyof Database['public']['Tables'], rows: T[], chunkSize = 300) {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await admin.from(table).insert(rows.slice(i, i + chunkSize) as never)
        if (error) throw new Error(`${table} (${spec.name}): ${error.message}`)
      }
    }
    await insertChunkedBranch('inventory', branchInventory)
    await insertChunkedBranch('invoices', branchInvoices)
    await insertChunkedBranch('invoice_items', branchItems)
    await insertChunkedBranch('payment_transactions', branchPayments)
    await insertChunkedBranch('inventory_ledger', branchLedger)
  }

  return SECONDARY_OUTLET_SPECS.length
}
