import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { parseLeaveDaysPerYear, parsePayrollRules } from '@/lib/utils/payrollRules'

const money = z.number().min(0).max(1_000_000_000)
const schema = z.object({
  late_penalty_per_minute: money,
  overtime_per_hour: money,
  absence_deduction_per_day: money,
  allowances: z.array(z.object({ label: z.string().trim().min(1).max(60), amount: money })).max(20),
  percent_deductions: z.array(z.object({ label: z.string().trim().min(1).max(60), percent: z.number().min(0).max(100) })).max(20),
  leave_days_per_year: z.number().int().min(0).max(365),
})

// GET/PATCH /api/admin/payroll-rules — master_admin only. Reads/writes
// companies.settings.payroll and settings.leave, merged so other settings keys
// survive. Consumed by POST /api/payroll/runs and the employee overview.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  return NextResponse.json({ ...parsePayrollRules(data?.settings), leave_days_per_year: parseLeaveDaysPerYear(data?.settings) })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { leave_days_per_year, ...payroll } = result.data

  const { data: current } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const settings = (current?.settings ?? {}) as Record<string, unknown>
  const { error } = await auth.supabase
    .from('companies')
    .update({ settings: { ...settings, payroll, leave: { ...((settings.leave as object) ?? {}), days_per_year: leave_days_per_year } } })
    .eq('id', auth.company_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'payroll_rules',
    entity_id: auth.company_id,
    new_values: result.data,
    status: 'success',
  })
  return NextResponse.json({ ok: true })
}
