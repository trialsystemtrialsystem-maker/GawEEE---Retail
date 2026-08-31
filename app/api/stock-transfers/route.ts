import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createStockTransferSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/stock-transfers?outlet_id=&status= — transfers where this outlet
// is either the source or the destination.
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
    .from('stock_transfers')
    .select('*, source:outlets!stock_transfers_source_outlet_id_fkey(name), destination:outlets!stock_transfers_destination_outlet_id_fkey(name)')
    .or(`source_outlet_id.eq.${outletId},destination_outlet_id.eq.${outletId}`)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'requested' | 'in_transit' | 'completed' | 'cancelled')

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ transfers: data })
}

// POST /api/stock-transfers — manager+ only. Creates a 'requested' transfer
// with its line items (not yet applied to inventory — that happens on ship).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createStockTransferSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.source_outlet_id) && !canAccessOutlet(auth, result.data.destination_outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const { items, ...transferFields } = result.data

  const { data: transfer, error } = await auth.supabase
    .from('stock_transfers')
    .insert({ ...transferFields, company_id: auth.company_id, requested_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { error: itemsError } = await auth.supabase
    .from('stock_transfer_items')
    .insert(items.map((i) => ({ ...i, transfer_id: transfer.id })))

  if (itemsError) {
    const { status, message } = handleDatabaseError(itemsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ transfer }, { status: 201 })
}
