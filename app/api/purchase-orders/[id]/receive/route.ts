import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, receivePurchaseOrderSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/purchase-orders/:id/receive — see prd.md §4.5.
//
// Unlike create_invoice()/void_invoice(), this isn't wrapped in a single SQL
// function: receiving is a lower-stakes operation (worst case on partial
// failure is a manual re-run/adjustment, not oversold stock or a lost sale),
// so the simpler sequential-calls approach is an acceptable trade-off here.
export async function POST(request: Request, ctx: RouteContext<'/api/purchase-orders/[id]/receive'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const result = validate(receivePurchaseOrderSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: po } = await auth.supabase.from('purchase_orders').select('*').eq('id', id).single()
  if (!po) return NextResponse.json({ error: 'Purchase order tidak ditemukan' }, { status: 404 })

  let totalReceivedAmount = 0

  for (const line of result.data.items) {
    const { data: poItem } = await auth.supabase.from('po_items').select('*').eq('id', line.po_item_id).single()
    if (!poItem || poItem.po_id !== id) continue
    if (line.quantity_received <= 0) continue

    const { error: invError } = await auth.supabase.rpc('update_inventory', {
      p_outlet_id: po.outlet_id,
      p_product_id: poItem.product_id,
      p_quantity_change: line.quantity_received,
      p_movement_type: 'purchase',
      p_recorded_by: auth.authUserId,
      p_reference_id: id,
      p_reference_type: 'purchase_order',
      p_unit_cost: poItem.unit_cost,
      p_batch_number: line.batch_number,
      p_expiry_date: line.expiry_date,
    })
    if (invError) {
      const { status, message } = handleDatabaseError(invError)
      return NextResponse.json({ error: message }, { status })
    }

    await auth.supabase
      .from('po_items')
      .update({ quantity_received: poItem.quantity_received + line.quantity_received })
      .eq('id', line.po_item_id)

    totalReceivedAmount += line.quantity_received * poItem.unit_cost
  }

  const { data: allItems } = await auth.supabase.from('po_items').select('quantity_ordered, quantity_received').eq('po_id', id)
  const fullyReceived = (allItems ?? []).every((i) => i.quantity_received >= i.quantity_ordered)
  const newStatus = fullyReceived ? 'received' : 'partial_received'

  await auth.supabase
    .from('purchase_orders')
    .update({ status: newStatus, actual_delivery_date: result.data.delivery_date ?? new Date().toISOString().slice(0, 10) })
    .eq('id', id)

  return NextResponse.json({
    receiving_id: id,
    inventory_updated: true,
    total_received_amount: totalReceivedAmount,
    po_status: newStatus,
  })
}
