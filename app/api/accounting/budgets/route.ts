import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { budgetVariance } from '@/lib/utils/budget'
import { selectAll } from '@/lib/utils/fetchAll'

const monthRe = /^\d{4}-\d{2}$/
const putSchema = z.object({
  outlet_id: z.string().uuid(),
  month: z.string().regex(monthRe),
  items: z.array(z.object({ account_id: z.string().uuid(), amount: z.number().min(0).max(1e12) })).max(200),
})

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { start: `${month}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
}

// GET /api/accounting/budgets?outlet_id=&month=YYYY-MM — every income/expense
// account with its budget, actual (posted journals in the month, closing
// entries excluded) and variance.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  if (!monthRe.test(month)) return NextResponse.json({ error: 'month harus YYYY-MM' }, { status: 400 })
  const { start, end } = monthBounds(month)

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: accounts, error } = await auth.supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type')
    .eq('outlet_id', outletId)
    .in('account_type', ['income', 'expense'])
    .order('account_code')
  if (error) return fail(error)
  const ids = (accounts ?? []).map((a) => a.id)
  if (ids.length === 0) return NextResponse.json({ rows: [] })

  const [budgetRes, lineRes] = await Promise.all([
    auth.supabase.from('budgets').select('account_id, amount').eq('outlet_id', outletId).eq('period_month', start),
    selectAll(auth.supabase
      .from('journal_entry_details')
      .select('account_id, debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
      .in('account_id', ids)
      .eq('journal_entries.outlet_id', outletId)
      .in('journal_entries.status', ['posted', 'reversed'])
      .or('source_type.is.null,source_type.neq.closing', { referencedTable: 'journal_entries' })
      .gte('journal_entries.entry_date', start)
      .lte('journal_entries.entry_date', end)),
  ])
  if (budgetRes.error) return fail(budgetRes.error)
  if (lineRes.error) return fail(lineRes.error)

  const budgetOf = new Map((budgetRes.data ?? []).map((b) => [b.account_id, b.amount]))
  const actualOf = new Map<string, number>()
  const typeOf = new Map((accounts ?? []).map((a) => [a.id, a.account_type]))
  for (const l of lineRes.data ?? []) {
    const delta = typeOf.get(l.account_id) === 'income' ? l.credit - l.debit : l.debit - l.credit
    actualOf.set(l.account_id, (actualOf.get(l.account_id) ?? 0) + delta)
  }

  const rows = (accounts ?? []).map((a) => {
    const budget = budgetOf.get(a.id) ?? 0
    const actual = actualOf.get(a.id) ?? 0
    return { account_id: a.id, account_code: a.account_code, account_name: a.account_name, account_type: a.account_type, budget, actual, ...budgetVariance(a.account_type as 'income' | 'expense', budget, actual) }
  })
  return NextResponse.json({ rows })
}

// PUT /api/accounting/budgets — replaces the month's budget for the given
// accounts (amount 0 removes the row).
export async function PUT(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(putSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { outlet_id, month, items } = result.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const period_month = `${month}-01`

  const positive = items.filter((i) => i.amount > 0)
  const zero = items.filter((i) => i.amount === 0).map((i) => i.account_id)
  if (positive.length) {
    const { error } = await auth.supabase
      .from('budgets')
      .upsert(positive.map((i) => ({ outlet_id, account_id: i.account_id, period_month, amount: i.amount })), { onConflict: 'outlet_id,account_id,period_month' })
    if (error) {
      const { status, message } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }
  }
  if (zero.length) await auth.supabase.from('budgets').delete().eq('outlet_id', outlet_id).eq('period_month', period_month).in('account_id', zero)
  return NextResponse.json({ ok: true })
}
