import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, customerRefundSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/customer-refunds?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('customer_refunds')
    .select('*, invoices(invoice_number)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ refunds: data })
}

// POST /api/customer-refunds — manager+ only (cash-out approval, same gate
// as purchase returns). Creates a draft refund with its line items — not
// yet applied to inventory until /submit.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(customerRefundSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { items, ...refundFields } = result.data

  const { data: refund, error } = await auth.supabase
    .from('customer_refunds')
    .insert({ ...refundFields, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase
    .from('customer_refund_items')
    .insert(items.map((i) => ({ ...i, refund_id: refund.id })))

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ refund }, { status: 201 })
}
