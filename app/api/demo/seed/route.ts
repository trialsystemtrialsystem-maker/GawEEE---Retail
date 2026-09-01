import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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

export async function POST() {
  const admin = createAdminClient()

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
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      company_id: companyId,
      outlet_id: outletId,
      stats: { reused_existing_data: true },
    })
  }

  // 1c) A genuinely empty tenant (first-ever seed, or a wipe with no data
  // yet) has nothing to show — must block on the full regenerate.
  if (!latestInvoice) {
    try {
      const stats = await regenerateDemoData(admin, companyId, outletId, userId)
      return NextResponse.json({ email: DEMO_EMAIL, password: DEMO_PASSWORD, company_id: companyId, outlet_id: outletId, stats })
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
  void regenerateDemoData(admin, companyId, outletId, userId).catch((err) => {
    console.error('[demo-seed] background reseed failed:', err)
  })

  return NextResponse.json({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
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
  if (poIds.length) await admin.from('po_items').delete().in('po_id', poIds)
  if (poIds.length) await admin.from('purchase_orders').delete().in('id', poIds)
  if (invoiceIds.length) await admin.from('payment_transactions').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('virtual_accounts').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('invoice_items').delete().in('invoice_id', invoiceIds)
  if (invoiceIds.length) await admin.from('customer_refunds').delete().in('invoice_id', invoiceIds)
  await admin.from('invoices').delete().eq('outlet_id', outletId)
  await admin.from('inventory_ledger').delete().eq('outlet_id', outletId)
  await admin.from('inventory').delete().eq('outlet_id', outletId)
  await admin.from('system_alerts').delete().eq('outlet_id', outletId)
  await admin.from('audit_log').delete().eq('company_id', companyId)
  await admin.from('held_transactions').delete().eq('outlet_id', outletId)
  await admin.from('cashier_shifts').delete().eq('outlet_id', outletId)
  await admin.from('product_bundles').delete().eq('outlet_id', outletId)

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
  await admin.from('item_requests').delete().eq('outlet_id', outletId)
  await admin.from('purchase_returns').delete().eq('outlet_id', outletId)
  await admin.from('special_prices').delete().eq('outlet_id', outletId)
  await admin.from('stock_transfers').delete().eq('company_id', companyId)
  await admin.from('stocktakes').delete().eq('outlet_id', outletId)

  const { error: productDeleteError } = await admin.from('products').delete().eq('company_id', companyId)
  if (productDeleteError) throw new Error(`products (delete): ${productDeleteError.message}`)
  await admin.from('product_categories').delete().eq('company_id', companyId)
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

      invoices.push({
        id: invoiceId,
        outlet_id: outletId,
        invoice_number: `INV-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(5, '0')}`,
        customer_name: Math.random() < 0.4 ? pick(DEMO_CUSTOMER_NAMES) : null,
        customer_phone: null,
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

  return {
    products: products.length,
    invoices: invoices.length,
    purchase_orders: purchaseOrders.length,
    days_of_history: DAYS_OF_HISTORY,
  }
}
