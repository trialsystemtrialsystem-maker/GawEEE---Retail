import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

type BookingRow = { facility_id: string | null; status: string; facilities: { name: string } | null }

// GET /api/reports/facility — booking counts per facility.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('bookings')
    .select('facility_id, status, facilities(name)')
    .eq('outlet_id', auth.outlet_id)
    .not('facility_id', 'is', null)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const rows = (data ?? []) as unknown as BookingRow[]
  const byFacility = new Map<string, { name: string; total: number; completed: number; cancelled: number }>()
  for (const r of rows) {
    if (!r.facility_id) continue
    const entry = byFacility.get(r.facility_id) ?? { name: r.facilities?.name ?? 'Fasilitas', total: 0, completed: 0, cancelled: 0 }
    entry.total += 1
    if (r.status === 'completed') entry.completed += 1
    if (r.status === 'cancelled') entry.cancelled += 1
    byFacility.set(r.facility_id, entry)
  }

  const facilities = Array.from(byFacility.entries())
    .map(([facilityId, v]) => ({ facility_id: facilityId, ...v }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ facilities })
}
