import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/payroll/runs/:id — run + its payslips, RLS-scoped.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/payroll/runs/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: run, error: runError } = await auth.supabase.from('payroll_runs').select('*').eq('id', id).single()
  if (runError) {
    const { status, message } = handleDatabaseError(runError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: payslips, error: payslipError } = await auth.supabase
    .from('payslips')
    .select('*, staff_members(first_name, last_name)')
    .eq('payroll_run_id', id)

  if (payslipError) {
    const { status, message } = handleDatabaseError(payslipError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ run, payslips })
}
