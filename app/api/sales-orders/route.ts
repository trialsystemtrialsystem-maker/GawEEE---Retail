import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createOrderSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/sales-orders?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('sales_orders')
    .select('*, sales_order_items(*, products(name))')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ orders: data })
}

// POST /api/sales-orders
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createOrderSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { outlet_id, customer_name, customer_phone, quotation_id, notes, items } = result.data
  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const orderNumber = `SO-${Date.now()}`

  const { data: order, error: orderError } = await auth.supabase
    .from('sales_orders')
    .insert({ outlet_id, customer_name, customer_phone, order_number: orderNumber, quotation_id, notes, created_by: auth.authUserId })
    .select('id')
    .single()

  if (orderError) {
    const { status, message } = handleDatabaseError(orderError)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase.from('sales_order_items').insert(
    items.map((item) => ({ order_id: order.id, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price }))
  )

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ order_id: order.id, order_number: orderNumber, status: 'draft' }, { status: 201 })
}
