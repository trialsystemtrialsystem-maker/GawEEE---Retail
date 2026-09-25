import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createInvoiceSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { earnLoyaltyPoints } from '@/lib/utils/loyalty'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { guardInvoiceDiscounts } from '@/lib/server/discountGuard'

// POST /api/invoices — create a POS transaction. See prd.md §4.3.
// The heavy lifting (stock validation, totals, inventory deduction) happens
// atomically in create_invoice() — see database/migrations/012_create_invoice_function.sql.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createInvoiceSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const {
    outlet_id,
    customer_name,
    customer_phone,
    items,
    discount_amount,
    discount_reason,
    payment_method,
    coupon_code,
    coupon_discount_amount,
    promotion_id,
    promotion_discount_amount,
    loyalty_customer_id,
    redeem_points,
    redeem_discount_amount,
  } = result.data

  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  // The browser computes every discount; never trust the total it sends.
  const discountError = await guardInvoiceDiscounts(auth, { outlet_id, items, discount_amount, coupon_code, coupon_discount_amount, promotion_id, promotion_discount_amount, loyalty_customer_id, redeem_points, redeem_discount_amount })
  if (discountError) return NextResponse.json({ error: discountError }, { status: 400 })

  const { data, error } = await auth.supabase
    .rpc('create_invoice', {
      p_outlet_id: outlet_id,
      p_cashier_id: auth.authUserId,
      p_items: items,
      p_payment_method: payment_method,
      p_customer_name: customer_name,
      p_customer_phone: customer_phone,
      p_discount_amount: discount_amount,
      p_discount_reason: discount_reason,
    })
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    const isStockError = error.message?.includes('Stok tidak cukup')
    return NextResponse.json({ error: message }, { status: isStockError ? 409 : status })
  }

  // Cosmetic-only follow-up (Multi-UOM Phase 11 + Notes Category/Kitchen
  // Report Phase 13): create_invoice() doesn't know about
  // unit_label/unit_quantity/notes/prep_status (they're not read from the
  // jsonb items it received), so stamp them onto the newly created
  // invoice_items rows here. Non-atomic with the RPC above on purpose — same
  // trade-off already used for PO receiving — since this never affects what
  // was charged, only how the receipt/kitchen board displays a line.
  const { data: createdItemsRaw } = await auth.supabase
    .from('invoice_items')
    .select('id, product_id, products(product_type)')
    .eq('invoice_id', data!.invoice_id)
  const createdItems = createdItemsRaw as unknown as { id: string; product_id: string; products: { product_type: string } | null }[] | null
  for (const line of items) {
    const match = createdItems?.find((ci) => ci.product_id === line.product_id)
    if (!match) continue
    const isService = match.products?.product_type === 'service'
    if (!line.unit_label && !line.notes && !isService) continue
    await auth.supabase
      .from('invoice_items')
      .update({
        sold_unit_label: line.unit_label,
        sold_unit_quantity: line.unit_quantity,
        notes: line.notes,
        prep_status: isService ? 'pending' : undefined,
      })
      .eq('id', match.id)
  }

  // Sales identification, both additive follow-ups (same non-atomic
  // trade-off as the sold_unit_label/notes stamping above) rather than
  // create_invoice() changes:
  //
  // 1. Link this sale to whichever cashier shift is currently open for the
  //    outlet — the app only allows one open shift per outlet at a time
  //    (see app/api/cashier-shifts/route.ts), so there's no ambiguity to
  //    resolve here. Silently no-ops if no shift is open (not every sale
  //    happens under an opened shift).
  const { data: openShift } = await auth.supabase
    .from('cashier_shifts')
    .select('id')
    .eq('outlet_id', outlet_id)
    .eq('status', 'open')
    .maybeSingle()
  if (openShift) {
    await auth.supabase.from('invoices').update({ cashier_shift_id: openShift.id }).eq('id', data!.invoice_id)
  }

  // 2. Record which coupon (if any) this sale actually redeemed, so usage
  //    can be traced back to a real transaction instead of just an
  //    aggregate counter (coupons.usage_count, incremented separately by
  //    POST /api/coupons/redeem when the code was first applied at
  //    cart-build time, before an invoice existed to link to).
  if (coupon_code && coupon_discount_amount) {
    const { data: coupon } = await auth.supabase.from('coupons').select('id').eq('outlet_id', outlet_id).ilike('code', coupon_code).maybeSingle()
    if (coupon) {
      await auth.supabase.from('coupon_redemptions').insert({
        coupon_id: coupon.id,
        invoice_id: data!.invoice_id,
        outlet_id,
        discount_amount: coupon_discount_amount,
        redeemed_by: auth.authUserId,
      })
    }
  }

  // 3. Same idea for a manually-applied promotion (063_loyalty_and_
  //    promotion_completion.sql) — `promotions` previously had zero usage
  //    tracking at all, not even an aggregate counter.
  if (promotion_id && promotion_discount_amount) {
    await auth.supabase.from('promotion_applications').insert({
      promotion_id,
      invoice_id: data!.invoice_id,
      outlet_id,
      discount_amount: promotion_discount_amount,
      applied_by: auth.authUserId,
    })
  }

  // 4. Redeem loyalty points for a discount, if the cashier applied one at
  //    checkout (mirrors coupon/promotion — a negative loyalty_ledger entry
  //    linked to this invoice instead of a positive auto-earned one).
  //    Re-checks the balance server-side rather than trusting the client's
  //    last-fetched number, since another sale could have spent points on
  //    the same customer in between — same best-effort, non-blocking
  //    philosophy as everything else in this file: if the balance turns out
  //    to be insufficient by the time we get here, just skip the redemption
  //    silently rather than unwind an already-completed sale over it.
  if (redeem_points && redeem_points > 0 && loyalty_customer_id) {
    const { data: ledgerRows } = await auth.supabase.from('loyalty_ledger').select('points_change').eq('customer_id', loyalty_customer_id)
    const balance = (ledgerRows ?? []).reduce((s, r) => s + r.points_change, 0)
    if (balance >= redeem_points) {
      await auth.supabase.from('loyalty_ledger').insert({
        customer_id: loyalty_customer_id,
        points_change: -redeem_points,
        reason: 'Penukaran poin saat transaksi',
        recorded_by: auth.authUserId,
        invoice_id: data!.invoice_id,
      })
    }
  }

  // 5. Auto-earn loyalty points for a registered customer — only for a
  //    sale that's actually settled already (cash, paid immediately by
  //    create_invoice()); e-wallet/bank still 'pending' at this point earn
  //    once they settle instead, from the payment routes below.
  if (data!.payment_status === 'paid') {
    await earnLoyaltyPoints(auth.supabase, data!.invoice_id)
  }

  const nextStep =
    payment_method === 'cash'
      ? 'receipt_ready'
      : payment_method === 'e_wallet'
        ? 'show_qr_code'
        : payment_method === 'bank_transfer'
          ? 'show_virtual_account'
          : 'receipt_ready'

  return NextResponse.json(
    {
      invoice_id: data!.invoice_id,
      invoice_number: data!.invoice_number,
      total: data!.total,
      payment_status: data!.payment_status,
      next_step: nextStep,
    },
    { status: 201 }
  )
}

// GET /api/invoices — list with filters. See prd.md §4.3.
// GET /api/invoices — filterable, paged invoice list.
// Filters: start/end (YYYY-MM-DD, UTC-safe) or the older from_date/to_date,
// search (invoice number / customer name / phone), status (paid | unpaid |
// pending | partial | voided), cashier_id ('me' allowed), outlet_id, page, limit.
// The summary is computed over EVERYTHING that matches the filters (not just
// the current page) and never counts voided invoices as revenue.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '50') || 50), 200)
  const hasRange = !!(searchParams.get('start') && searchParams.get('end'))
  const range = hasRange ? resolveDateRange(searchParams) : null
  const fromDate = range?.startIso ?? searchParams.get('from_date')
  const toDate = range?.endIso ?? searchParams.get('to_date')
  const status = searchParams.get('status')
  const paymentStatus = searchParams.get('payment_status')
  const outletId = searchParams.get('outlet_id')
  const cashierIdParam = searchParams.get('cashier_id')
  const search = searchParams.get('search')?.trim().replace(/[%,()]/g, '')

  type Q = ReturnType<typeof buildBase>
  function buildBase(select: string, count?: 'exact') {
    let q = auth!.supabase.from('invoices').select(select, count ? { count } : undefined)
    if (auth!.role === 'master_admin') {
      if (outletId) q = q.eq('outlet_id', outletId)
    } else {
      q = q.eq('outlet_id', auth!.outlet_id!)
    }
    if (fromDate) q = q.gte('created_at', fromDate)
    if (toDate) q = q.lte('created_at', toDate)
    if (paymentStatus) q = q.eq('payment_status', paymentStatus as 'pending' | 'partial' | 'paid')
    if (status === 'voided') q = q.eq('order_status', 'voided')
    else if (status === 'paid') q = q.eq('payment_status', 'paid').neq('order_status', 'voided')
    else if (status === 'unpaid') q = q.in('payment_status', ['pending', 'partial']).neq('order_status', 'voided')
    else if (status === 'pending' || status === 'partial') q = q.eq('payment_status', status).neq('order_status', 'voided')
    // "me" resolves server-side to the caller's own id — used by the Riwayat
    // Kasir self-service view so a cashier only ever sees their own sales,
    // without the client needing to know/pass its own user id.
    if (cashierIdParam) q = q.eq('cashier_id', cashierIdParam === 'me' ? auth!.authUserId : cashierIdParam) // create_invoice() writes cashier_id = p_cashier_id = auth.authUserId (see POST above)
    if (search) q = q.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    return q
  }

  const from = (page - 1) * limit
  const { data, error, count } = await (buildBase('*, users!cashier_id(full_name), outlets(name)', 'exact') as Q).order('created_at', { ascending: false }).range(from, from + limit - 1)
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  // Aggregate over the whole filtered set, paging past PostgREST's 1000-row cap.
  let revenue = 0
  let discounts = 0
  let counted = 0
  let voided = 0
  let unpaid = 0
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data: chunk, error: aggError } = await (buildBase('total, discount_amount, order_status, payment_status') as Q).order('created_at', { ascending: false }).range(offset, offset + 999)
    if (aggError) break
    for (const row of (chunk ?? []) as unknown as { total: number; discount_amount: number; order_status: string; payment_status: string }[]) {
      if (row.order_status === 'voided') {
        voided += 1
        continue
      }
      revenue += row.total
      discounts += row.discount_amount
      counted += 1
      if (row.payment_status !== 'paid') unpaid += row.total
    }
    if (!chunk || chunk.length < 1000) break
  }

  const invoices = (data ?? []) as unknown as (Record<string, unknown> & { users?: { full_name: string | null } | null; outlets?: { name: string } | null })[]
  return NextResponse.json({
    invoices: invoices.map((i) => ({ ...i, cashier_name: (Array.isArray(i.users) ? i.users[0] : i.users)?.full_name ?? null, outlet_name: (Array.isArray(i.outlets) ? i.outlets[0] : i.outlets)?.name ?? null })),
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    summary: {
      total_revenue: revenue,
      total_discounts: discounts,
      avg_transaction: counted ? revenue / counted : 0,
      transactions: counted,
      voided,
      unpaid_total: unpaid,
    },
  })
}
