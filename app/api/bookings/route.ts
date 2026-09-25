import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createBookingSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { findConflicts } from '@/lib/utils/bookingConflicts'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/bookings?outlet_id=&start=&end=&status=&search= — bookings in a date
// window (default: 7 days back to 60 days ahead), so a busy outlet's history
// never loads all at once.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const day = 86_400_000
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const start = searchParams.get('start') ?? iso(Date.now() - 7 * day)
  const end = searchParams.get('end') ?? iso(Date.now() + 60 * day)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim().replace(/[%,()]/g, '')

  let query = auth.supabase
    .from('bookings')
    .select('*, staff_members(first_name, last_name), facilities(name)')
    .eq('outlet_id', outletId)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_start_time', { ascending: true })
  if (status) query = query.eq('status', status as 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show')
  if (search) query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,item_description.ilike.%${search}%`)

  const { data, error } = await selectAll(query)
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }

  return NextResponse.json({ bookings: data })
}

// POST /api/bookings — refuses a slot that clashes with an existing booking for
// the same staff member or facility (409 with what it clashes with). `force`
// lets a manager knowingly double-book.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createBookingSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const force = body.force === true && ['outlet_manager', 'master_admin'].includes(auth.role)
  if (!force && (result.data.staff_id || result.data.facility_id)) {
    const { data: sameDay } = await auth.supabase
      .from('bookings')
      .select('id, customer_name, scheduled_date, scheduled_start_time, scheduled_end_time, staff_id, facility_id, status')
      .eq('outlet_id', result.data.outlet_id)
      .eq('scheduled_date', result.data.scheduled_date)
    const clashes = findConflicts(
      { scheduled_date: result.data.scheduled_date, scheduled_start_time: result.data.scheduled_start_time, scheduled_end_time: result.data.scheduled_end_time ?? null, staff_id: result.data.staff_id ?? null, facility_id: result.data.facility_id ?? null },
      sameDay ?? []
    )
    if (clashes.length > 0) {
      const c = clashes[0]
      return NextResponse.json(
        {
          error: `Bentrok dengan booking ${c.booking.customer_name} (${c.booking.scheduled_start_time.slice(0, 5)}${c.booking.scheduled_end_time ? `–${c.booking.scheduled_end_time.slice(0, 5)}` : ''}) — ${c.reasons.includes('staff') ? 'staf' : 'fasilitas'} yang sama sudah terpakai`,
          conflicts: clashes.map((x) => ({ id: x.booking.id, customer_name: x.booking.customer_name, reasons: x.reasons })),
        },
        { status: 409 }
      )
    }
  }

  const { data, error } = await auth.supabase
    .from('bookings')
    .insert({ ...result.data, created_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ booking: data }, { status: 201 })
}
