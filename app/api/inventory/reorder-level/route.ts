import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const schema = z.object({
  outlet_id: z.string().uuid(),
  product_id: z.string().uuid(),
  reorder_level: z.number().int().min(0).max(1_000_000),
})

// PATCH /api/inventory/reorder-level — sets this outlet's own reorder point for
// a product (overrides the product-wide default) and re-evaluates the alert
// status immediately, so the change shows on the stock list without waiting for
// the next stock movement.
export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'inventory.adjust'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { outlet_id, product_id, reorder_level } = result.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data: row } = await auth.supabase.from('inventory').select('quantity_on_hand').eq('outlet_id', outlet_id).eq('product_id', product_id).single()
  if (!row) return NextResponse.json({ error: 'Stok produk tidak ditemukan di outlet ini' }, { status: 404 })

  const alert_status = row.quantity_on_hand <= 0 ? 'out_of_stock' : row.quantity_on_hand <= reorder_level ? 'low_stock' : 'normal'
  const { error } = await auth.supabase.from('inventory').update({ reorder_level, alert_status }).eq('outlet_id', outlet_id).eq('product_id', product_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    outlet_id,
    action_type: 'UPDATE',
    entity_type: 'inventory_reorder_level',
    entity_id: product_id,
    new_values: { reorder_level },
    status: 'success',
  })
  return NextResponse.json({ reorder_level, alert_status })
}
