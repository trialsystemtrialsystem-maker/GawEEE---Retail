import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createInvoiceSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/invoices — create a POS transaction. See prd.md §4.3.
// The heavy lifting (stock validation, totals, inventory deduction) happens
// atomically in create_invoice() — see database/migrations/012_create_invoice_function.sql.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createInvoiceSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { outlet_id, customer_name, customer_phone, items, discount_amount, discount_reason, payment_method } =
    result.data

  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

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

  // Cosmetic-only follow-up (Multi-UOM, Phase 11 plan item 10): create_invoice()
  // doesn't know about unit_label/unit_quantity (they're not read from the
  // jsonb items it received), so stamp them onto the newly created
  // invoice_items rows here. Non-atomic with the RPC above on purpose — same
  // trade-off already used for PO receiving — since this only affects how
  // the receipt displays a line, never what was actually charged.
  const itemsWithUnits = items.filter((i) => i.unit_label)
  if (itemsWithUnits.length > 0) {
    const { data: createdItems } = await auth.supabase
      .from('invoice_items')
      .select('id, product_id')
      .eq('invoice_id', data!.invoice_id)
    for (const line of itemsWithUnits) {
      const match = createdItems?.find((ci) => ci.product_id === line.product_id)
      if (match) {
        await auth.supabase
          .from('invoice_items')
          .update({ sold_unit_label: line.unit_label, sold_unit_quantity: line.unit_quantity })
          .eq('id', match.id)
      }
    }
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
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const paymentStatus = searchParams.get('payment_status')
  const outletId = searchParams.get('outlet_id')
  const cashierIdParam = searchParams.get('cashier_id')

  let query = auth.supabase.from('invoices').select('*', { count: 'exact' }).order('created_at', { ascending: false })

  if (auth.role === 'master_admin') {
    if (outletId) query = query.eq('outlet_id', outletId)
  } else {
    query = query.eq('outlet_id', auth.outlet_id!)
  }

  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)
  if (paymentStatus) {
    query = query.eq('payment_status', paymentStatus as 'pending' | 'partial' | 'paid')
  }
  // "me" resolves server-side to the caller's own id — used by the Riwayat
  // Kasir self-service view so a cashier only ever sees their own sales,
  // without the client needing to know/pass its own user id.
  if (cashierIdParam) {
    query = query.eq('cashier_id', cashierIdParam === 'me' ? auth.authUserId : cashierIdParam) // create_invoice() writes cashier_id = p_cashier_id = auth.authUserId (see app/api/invoices POST)
  }

  const from = (page - 1) * limit
  const { data, error, count } = await query.range(from, from + limit - 1)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const invoices = data ?? []
  const totalRevenue = invoices.reduce((sum, i) => sum + i.total, 0)
  const totalDiscounts = invoices.reduce((sum, i) => sum + i.discount_amount, 0)

  return NextResponse.json({
    invoices,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    summary: {
      total_revenue: totalRevenue,
      total_discounts: totalDiscounts,
      avg_transaction: invoices.length ? totalRevenue / invoices.length : 0,
    },
  })
}
