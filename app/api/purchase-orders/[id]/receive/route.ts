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

  // Only an ordered / partly received PO can take goods, and never more than is
  // still outstanding per line (both were previously unchecked, so a draft or
  // cancelled PO could be "received" and a delivery could over-fill a line).
  if (!['ordered', 'partial_received'].includes(po.status)) {
    return NextResponse.json({ error: 'PO ini tidak dalam status yang bisa menerima barang' }, { status: 409 })
  }
  const { data: outstanding } = await auth.supabase.from('po_items').select('id, quantity_ordered, quantity_received').eq('po_id', id)
  const remainingById = new Map((outstanding ?? []).map((i) => [i.id, i.quantity_ordered - i.quantity_received]))
  const over = result.data.items.filter((l) => l.quantity_received > (remainingById.get(l.po_item_id) ?? 0))
  if (over.length > 0) {
    return NextResponse.json({ error: 'Jumlah diterima melebihi sisa pesanan pada satu atau lebih barang' }, { status: 400 })
  }

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

  // Additive call, not a create_invoice()-style function change (same
  // precedent as Petty Cash and 059_auto_post_journal_entries.sql): goods
  // received increase inventory and create a payable to the supplier, until
  // the purchase invoice actually gets paid. Best-effort — a missing chart
  // of accounts (an outlet whose default COA was never seeded) just skips
  // this, same as the sales-side triggers; receiving must never fail or roll
  // back because bookkeeping couldn't post.
  if (totalReceivedAmount > 0) {
    try {
      const [{ data: inventoryAccount }, { data: payableAccount }] = await Promise.all([
        auth.supabase.from('chart_of_accounts').select('id').eq('outlet_id', po.outlet_id).eq('account_code', '1200').maybeSingle(),
        auth.supabase.from('chart_of_accounts').select('id').eq('outlet_id', po.outlet_id).eq('account_code', '2000').maybeSingle(),
      ])
      if (inventoryAccount && payableAccount) {
        const { data: entryResult } = await auth.supabase
          .rpc('create_journal_entry', {
            p_outlet_id: po.outlet_id,
            p_created_by: auth.authUserId,
            p_entry_date: new Date().toISOString().slice(0, 10),
            p_description: `Penerimaan PO ${po.po_number}`,
            p_lines: [
              { account_id: inventoryAccount.id, debit: totalReceivedAmount, credit: 0, description: po.po_number },
              { account_id: payableAccount.id, debit: 0, credit: totalReceivedAmount, description: po.po_number },
            ],
            p_source_type: 'purchase',
            p_source_id: id,
          })
          .single()
        if (entryResult) await auth.supabase.rpc('post_journal_entry', { p_entry_id: entryResult.journal_entry_id })
      }
    } catch {
      // Bookkeeping failure must never block a real receiving transaction.
    }
  }

  return NextResponse.json({
    receiving_id: id,
    inventory_updated: true,
    total_received_amount: totalReceivedAmount,
    po_status: newStatus,
  })
}
