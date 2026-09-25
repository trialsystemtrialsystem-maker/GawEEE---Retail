import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const schema = z.object({ reason: z.string().trim().min(3, 'Alasan wajib diisi').max(300) })

// POST /api/purchase-orders/:id/cancel { reason } — manager+ only. A PO can be
// cancelled while nothing has been received against it; once goods arrived the
// remainder is closed by receiving/returning, not by cancelling.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/purchase-orders/[id]/cancel'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: po } = await auth.supabase.from('purchase_orders').select('id, outlet_id, status, notes').eq('id', id).single()
  if (!po || !canAccessOutlet(auth, po.outlet_id)) return NextResponse.json({ error: 'Purchase order tidak ditemukan' }, { status: 404 })
  if (!['draft', 'pending_approval', 'ordered'].includes(po.status)) {
    return NextResponse.json({ error: 'PO dengan status ini tidak bisa dibatalkan' }, { status: 409 })
  }
  const { data: items } = await auth.supabase.from('po_items').select('quantity_received').eq('po_id', id)
  if ((items ?? []).some((i) => i.quantity_received > 0)) {
    return NextResponse.json({ error: 'PO sudah menerima sebagian barang — tidak bisa dibatalkan' }, { status: 409 })
  }

  const note = `Dibatalkan: ${result.data.reason}`
  const { error } = await auth.supabase
    .from('purchase_orders')
    .update({ status: 'cancelled', notes: po.notes ? `${po.notes}\n${note}` : note })
    .eq('id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ status: 'cancelled' })
}
