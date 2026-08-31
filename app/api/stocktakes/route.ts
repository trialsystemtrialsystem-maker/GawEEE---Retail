import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createStocktakeSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/stocktakes?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('stocktakes')
    .select('*')
    .eq('outlet_id', outletId)
    .order('scheduled_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ stocktakes: data })
}

// POST /api/stocktakes — manager+ only. Starts a new count session,
// snapshotting expected_quantity from `inventory` for every product at the
// outlet (counted_quantity defaults to the same value until staff edit it).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(createStocktakeSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: inventoryRows, error: invError } = await auth.supabase
    .from('inventory')
    .select('product_id, quantity_on_hand')
    .eq('outlet_id', result.data.outlet_id)

  if (invError) {
    const { status, message } = handleDatabaseError(invError)
    return NextResponse.json({ error: message }, { status })
  }
  if (!inventoryRows || inventoryRows.length === 0) {
    return NextResponse.json({ error: 'Belum ada produk dengan stok di outlet ini' }, { status: 400 })
  }

  const { data: stocktake, error: stError } = await auth.supabase
    .from('stocktakes')
    .insert({
      outlet_id: result.data.outlet_id,
      scheduled_date: result.data.scheduled_date,
      notes: result.data.notes,
      created_by: auth.id,
      status: 'in_progress',
      actual_start_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (stError) {
    const { status, message } = handleDatabaseError(stError)
    return NextResponse.json({ error: message }, { status })
  }

  const details = inventoryRows.map((r) => ({
    stocktake_id: stocktake.id,
    product_id: r.product_id,
    expected_quantity: r.quantity_on_hand,
    counted_quantity: r.quantity_on_hand,
  }))

  const { error: detailsError } = await auth.supabase.from('stocktake_details').insert(details)
  if (detailsError) {
    const { status, message } = handleDatabaseError(detailsError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ stocktake }, { status: 201 })
}
