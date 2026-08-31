import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, stockWasteSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/inventory/waste?outlet_id= — recent waste write-offs, from
// inventory_ledger (movement_type='waste').
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('inventory_ledger')
    .select('id, quantity_change, unit_cost, notes, created_at, products(name)')
    .eq('outlet_id', outletId)
    .eq('movement_type', 'waste')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ entries: data })
}

// POST /api/inventory/waste — manager+ only. Writes off damaged/expired
// stock via update_inventory() (movement_type='waste', negative quantity).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(stockWasteSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: product } = await auth.supabase.from('products').select('purchase_price').eq('id', result.data.product_id).single()

  const { data, error } = await auth.supabase.rpc('update_inventory', {
    p_outlet_id: result.data.outlet_id,
    p_product_id: result.data.product_id,
    p_quantity_change: -Math.abs(result.data.quantity),
    p_movement_type: 'waste',
    p_recorded_by: auth.id,
    p_reference_type: 'waste',
    p_unit_cost: product?.purchase_price ?? undefined,
    p_notes: result.data.reason,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ new_quantity: data?.[0]?.new_quantity_on_hand }, { status: 201 })
}
