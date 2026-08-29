import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createPurchaseOrderSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-orders — manager+ only. See prd.md §4.5.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createPurchaseOrderSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { outlet_id, supplier_id, items, requested_delivery_date, notes } = result.data
  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const poNumber = `PO-${Date.now()}`

  const { data: po, error: poError } = await auth.supabase
    .from('purchase_orders')
    .insert({
      outlet_id,
      supplier_id,
      po_number: poNumber,
      requested_delivery_date,
      notes,
      subtotal,
      total: subtotal,
      created_by: auth.authUserId,
      status: 'draft',
    })
    .select('id')
    .single()

  if (poError) {
    const { status, message } = handleDatabaseError(poError)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase.from('po_items').insert(
    items.map((item) => ({
      po_id: po.id,
      product_id: item.product_id,
      quantity_ordered: item.quantity,
      unit_cost: item.unit_cost,
    }))
  )

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ po_id: po.id, po_number: poNumber, total: subtotal, status: 'draft' }, { status: 201 })
}

// GET /api/purchase-orders — list with filters (outlet + status)
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')

  let query = auth.supabase.from('purchase_orders').select('*, suppliers(name)').order('created_at', { ascending: false })

  if (auth.role === 'master_admin') {
    const outletId = searchParams.get('outlet_id')
    if (outletId) query = query.eq('outlet_id', outletId)
  } else {
    query = query.eq('outlet_id', auth.outlet_id!)
  }
  if (status) query = query.eq('status', status as 'draft' | 'ordered' | 'partial_received' | 'received' | 'cancelled')

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ purchase_orders: data })
}
