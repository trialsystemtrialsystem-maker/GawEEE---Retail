import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import type { OnlineOrder } from '@/lib/types/database.types'

const updateSchema = z
  .object({
    customer_phone: z.string().trim().max(20).nullable(),
    delivery_address: z.string().trim().max(500).nullable(),
    courier: z.string().trim().max(60).nullable(),
    tracking_number: z.string().trim().max(100).nullable(),
    external_ref: z.string().trim().max(100).nullable(),
    notes: z.string().trim().max(1000).nullable(),
  })
  .partial()

// PATCH /api/online-orders/:id — fix delivery/contact details while the order is
// still open (status moves go through /status).
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/online-orders/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = validate(updateSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  if (Object.keys(result.data).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  const { data: order } = await auth.supabase.from('online_orders').select('status').eq('id', id).single()
  if (!order) return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  if (['completed', 'cancelled'].includes(order.status)) return NextResponse.json({ error: 'Pesanan yang sudah selesai/dibatalkan tidak bisa diubah' }, { status: 409 })

  const { data, error } = await auth.supabase.from('online_orders').update(result.data as Partial<OnlineOrder>).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ order: data })
}
