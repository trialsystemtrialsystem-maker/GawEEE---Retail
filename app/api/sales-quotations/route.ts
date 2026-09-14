import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createQuotationSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/sales-quotations?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('sales_quotations')
    .select('*, sales_quotation_items(*, products(name))')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ quotations: data })
}

// POST /api/sales-quotations
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createQuotationSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { outlet_id, customer_name, customer_phone, valid_until, notes, items } = result.data
  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const quotationNumber = `QUO-${Date.now()}`

  const { data: quotation, error: quotationError } = await auth.supabase
    .from('sales_quotations')
    .insert({ outlet_id, customer_name, customer_phone, quotation_number: quotationNumber, valid_until, notes, created_by: auth.authUserId })
    .select('id')
    .single()

  if (quotationError) {
    const { status, message } = handleDatabaseError(quotationError)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase.from('sales_quotation_items').insert(
    items.map((item) => ({ quotation_id: quotation.id, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price }))
  )

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ quotation_id: quotation.id, quotation_number: quotationNumber, status: 'draft' }, { status: 201 })
}
