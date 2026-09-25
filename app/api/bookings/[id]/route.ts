import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { findConflicts } from '@/lib/utils/bookingConflicts'
import type { Booking } from '@/lib/types/database.types'

const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Format jam HH:MM')

// Status moves and/or edits (reschedule, reassign, contact/notes) in one
// endpoint. Every field is optional but at least one is required.
const updateSchema = z
  .object({
    status: z.enum(STATUSES),
    cancel_reason: z.string().trim().max(200),
    customer_name: z.string().trim().min(1).max(255),
    customer_phone: z.string().trim().max(20).nullable(),
    item_description: z.string().trim().min(1).max(255),
    staff_id: z.string().uuid().nullable(),
    facility_id: z.string().uuid().nullable(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduled_start_time: time,
    scheduled_end_time: time.nullable(),
    notes: z.string().trim().max(1000).nullable(),
    force: z.boolean(),
  })
  .partial()

// PATCH /api/bookings/:id — RLS scopes the row to an accessible outlet. A
// reschedule/reassignment is checked for clashes exactly like a new booking.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/bookings/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const result = validate(updateSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { force, cancel_reason, ...fields } = result.data
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })

  const { data: current } = await auth.supabase.from('bookings').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 })
  if (['completed', 'cancelled', 'no_show'].includes(current.status) && fields.status === undefined) {
    return NextResponse.json({ error: 'Booking yang sudah selesai/dibatalkan tidak bisa diubah' }, { status: 409 })
  }

  const moved = ['scheduled_date', 'scheduled_start_time', 'scheduled_end_time', 'staff_id', 'facility_id'].some((k) => k in fields)
  const reopening = fields.status && !['cancelled', 'no_show'].includes(fields.status)
  if ((moved || (reopening && ['cancelled', 'no_show'].includes(current.status))) && !(force && ['outlet_manager', 'master_admin'].includes(auth.role))) {
    const merged = { ...current, ...fields }
    const { data: sameDay } = await auth.supabase
      .from('bookings')
      .select('id, customer_name, scheduled_date, scheduled_start_time, scheduled_end_time, staff_id, facility_id, status')
      .eq('outlet_id', current.outlet_id)
      .eq('scheduled_date', merged.scheduled_date)
    const clashes = findConflicts({ id, scheduled_date: merged.scheduled_date, scheduled_start_time: merged.scheduled_start_time, scheduled_end_time: merged.scheduled_end_time ?? null, staff_id: merged.staff_id ?? null, facility_id: merged.facility_id ?? null }, sameDay ?? [])
    if (clashes.length > 0) {
      return NextResponse.json({ error: `Bentrok dengan booking ${clashes[0].booking.customer_name} — ${clashes[0].reasons.includes('staff') ? 'staf' : 'fasilitas'} yang sama sudah terpakai` }, { status: 409 })
    }
  }

  const patch: Partial<Booking> = { ...fields }
  if ((fields.status === 'cancelled' || fields.status === 'no_show') && cancel_reason) {
    patch.notes = current.notes ? `${current.notes}\n${fields.status === 'no_show' ? 'Tidak hadir' : 'Dibatalkan'}: ${cancel_reason}` : `${fields.status === 'no_show' ? 'Tidak hadir' : 'Dibatalkan'}: ${cancel_reason}`
  }

  const { data, error } = await auth.supabase.from('bookings').update(patch).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ booking: data })
}
