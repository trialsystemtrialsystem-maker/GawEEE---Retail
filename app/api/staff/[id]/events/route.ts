import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const schema = z.object({
  event_type: z.enum(['note', 'warning']),
  note: z.string().trim().min(3, 'Catatan wajib diisi'),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// POST /api/staff/:id/events — manual timeline entry (catatan / peringatan).
// Employment changes (jabatan, gaji, status, kontrak) are logged by a DB
// trigger; this route only adds the human-written ones.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/staff/[id]/events'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: staff } = await auth.supabase.from('staff_members').select('id, outlet_id').eq('id', id).single()
  if (!staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, staff.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase
    .from('staff_events')
    .insert({
      outlet_id: staff.outlet_id,
      staff_id: id,
      event_type: result.data.event_type,
      note: result.data.note,
      ...(result.data.occurred_on ? { occurred_on: result.data.occurred_on } : {}),
      created_by: auth.id,
    })
    .select()
    .single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ event: data }, { status: 201 })
}
