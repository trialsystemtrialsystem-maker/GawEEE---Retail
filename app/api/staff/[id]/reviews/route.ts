import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const score = z.number().int().min(1).max(5)
const schema = z.object({
  period_label: z.string().trim().min(2, 'Periode wajib diisi').max(60),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  overall_score: score,
  ratings: z.record(z.string().max(40), score).default({}),
  strengths: z.string().trim().max(1000).optional(),
  improvements: z.string().trim().max(1000).optional(),
})

// POST /api/staff/:id/reviews — penilaian kinerja (skor 1–5 keseluruhan plus
// nilai per aspek, catatan kekuatan dan area perbaikan).
export async function POST(request: NextRequest, ctx: RouteContext<'/api/staff/[id]/reviews'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { id } = await ctx.params

  const { data: staff } = await auth.supabase.from('staff_members').select('id, outlet_id').eq('id', id).single()
  if (!staff || !canAccessOutlet(auth, staff.outlet_id)) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('performance_reviews')
    .insert({ ...result.data, outlet_id: staff.outlet_id, staff_id: id, reviewer_id: auth.id })
    .select()
    .single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ review: data }, { status: 201 })
}
