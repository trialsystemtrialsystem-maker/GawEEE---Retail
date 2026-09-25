import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate, inventoryAdjustSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postStockValueJournal } from '@/lib/utils/journalPosting'

// POST /api/inventory/adjust — manual adjustment, manager+ only. See prd.md §4.2.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(inventoryAdjustSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { outlet_id, product_id, quantity_change, reason, reference } = result.data
  if (!canAccessOutlet(auth, outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin untuk outlet ini' }, { status: 403 })
  }

  const { data, error } = await auth.supabase.rpc('update_inventory', {
    p_outlet_id: outlet_id,
    p_product_id: product_id,
    p_quantity_change: quantity_change,
    p_movement_type: 'adjustment',
    p_reference_id: null,
    p_recorded_by: auth.authUserId,
    p_reference_type: 'manual',
    p_notes: reference ? `${reason} (ref: ${reference})` : reason,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const newQuantity = Array.isArray(data) ? data[0]?.new_quantity_on_hand : undefined

  // Book the write-down/write-up at cost (best-effort; never blocks the adjustment).
  const [{ data: priced }, { data: invRow }] = await Promise.all([
    auth.supabase.from('products').select('purchase_price').eq('id', product_id).single(),
    auth.supabase.from('inventory').select('avg_cost').eq('outlet_id', outlet_id).eq('product_id', product_id).maybeSingle(),
  ])
  await postStockValueJournal(auth.supabase, {
    outletId: outlet_id,
    createdBy: auth.id,
    date: new Date().toISOString().slice(0, 10),
    description: `Penyesuaian stok: ${reason}`,
    sourceType: 'stock_adjustment',
    sourceId: crypto.randomUUID(),
    value: quantity_change * (invRow?.avg_cost ?? priced?.purchase_price ?? 0),
  })

  const { data: auditEntry } = await auth.supabase
    .from('audit_log')
    .insert({
      user_id: auth.authUserId,
      company_id: auth.company_id,
      outlet_id,
      action_type: 'UPDATE',
      entity_type: 'inventory',
      entity_id: product_id,
      new_values: { quantity_change, new_quantity: newQuantity },
      reason_for_action: reason,
      status: 'success',
    })
    .select('id')
    .single()

  return NextResponse.json({
    adjustment_id: auditEntry?.id ?? null,
    new_quantity: newQuantity,
    audit_log_id: auditEntry?.id ?? null,
  })
}
