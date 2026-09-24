import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const ruleSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama aturan wajib diisi').max(100),
  metric: z.enum(['sales_target', 'transactions', 'attendance_bonus']),
  threshold: z.number().min(0),
  amount: z.number().min(0),
})

// GET /api/incentive-rules?outlet_id= — any staff who can access the outlet may
// read the rules (transparency); creating/editing needs payroll.manage.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase.from('incentive_rules').select('*').eq('outlet_id', outletId).order('created_at')
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ rules: data })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(ruleSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  if (!canAccessOutlet(auth, result.data.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase.from('incentive_rules').insert({ ...result.data, created_by: auth.id }).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ rule: data }, { status: 201 })
}
