import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createOnlineOrderSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/online-orders?outlet_id=&status=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const status = searchParams.get('status')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase
    .from('online_orders')
    .select('*')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq(
      'status',
      status as 'incoming' | 'on_process' | 'on_delivery' | 'completed' | 'cancelled'
    )
  }

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ orders: data })
}

// POST /api/online-orders — logs an order received via WhatsApp/Instagram/
// marketplace (no live channel integration exists, this is manual entry).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createOnlineOrderSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const totalAmount = result.data.items.reduce((s, i) => s + i.quantity * i.price, 0)
  const orderNumber = `ONL-${Date.now()}`

  const { data, error } = await auth.supabase
    .from('online_orders')
    .insert({ ...result.data, order_number: orderNumber, total_amount: totalAmount, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ order: data }, { status: 201 })
}
