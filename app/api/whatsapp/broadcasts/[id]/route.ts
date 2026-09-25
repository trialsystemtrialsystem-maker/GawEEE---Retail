import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/whatsapp/broadcasts/:id — the send queue with progress.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/whatsapp/broadcasts/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const { data: broadcast } = await auth.supabase.from('whatsapp_broadcasts').select('*, whatsapp_templates(name, content)').eq('id', id).single()
  if (!broadcast) return NextResponse.json({ error: 'Broadcast tidak ditemukan' }, { status: 404 })

  const { data: recipients, error } = await selectAll(
    auth.supabase.from('whatsapp_broadcast_recipients').select('id, name, phone, message, status, sent_at').eq('broadcast_id', id).order('created_at')
  )
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  const list = recipients ?? []
  return NextResponse.json({
    broadcast,
    recipients: list,
    counts: { total: list.length, pending: list.filter((r) => r.status === 'pending').length, sent: list.filter((r) => r.status === 'sent').length, skipped: list.filter((r) => r.status === 'skipped').length },
  })
}

const patchSchema = z.object({
  recipient_ids: z.array(z.string().uuid()).min(1).max(1000).optional(),
  status: z.enum(['sent', 'skipped', 'pending']),
})

// PATCH /api/whatsapp/broadcasts/:id { status, recipient_ids? } — mark recipients
// (or, without ids, every still-pending one) as sent/skipped. sent_count and the
// broadcast status follow: 'sent' once nothing is pending.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/whatsapp/broadcasts/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const result = validate(patchSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { recipient_ids, status } = result.data

  const { data: broadcast } = await auth.supabase.from('whatsapp_broadcasts').select('id').eq('id', id).single()
  if (!broadcast) return NextResponse.json({ error: 'Broadcast tidak ditemukan' }, { status: 404 })

  let q = auth.supabase
    .from('whatsapp_broadcast_recipients')
    .update({ status, sent_at: status === 'sent' ? new Date().toISOString() : null })
    .eq('broadcast_id', id)
  q = recipient_ids ? q.in('id', recipient_ids) : q.eq('status', 'pending')
  const { error } = await q
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }

  const [{ count: sent }, { count: pending }] = await Promise.all([
    auth.supabase.from('whatsapp_broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', id).eq('status', 'sent'),
    auth.supabase.from('whatsapp_broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', id).eq('status', 'pending'),
  ])
  await auth.supabase
    .from('whatsapp_broadcasts')
    .update({ sent_count: sent ?? 0, status: (pending ?? 0) === 0 ? 'sent' : 'draft', sent_at: (pending ?? 0) === 0 ? new Date().toISOString() : null })
    .eq('id', id)

  return NextResponse.json({ sent: sent ?? 0, pending: pending ?? 0 })
}
