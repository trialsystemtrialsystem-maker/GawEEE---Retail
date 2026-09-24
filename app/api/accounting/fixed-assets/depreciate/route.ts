import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postJournal } from '@/lib/utils/journalPosting'
import { depreciationForMonth, monthStart } from '@/lib/utils/depreciation'

const schema = z.object({ outlet_id: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/) })

// POST /api/accounting/fixed-assets/depreciate { outlet_id, month } — books one
// month of straight-line depreciation for every active asset that has not been
// depreciated for that month yet: Dr Beban Penyusutan 5400 / Cr Akumulasi
// Penyusutan 1590, one journal per run, dated the last day of the month.
// Idempotent: (asset, month) is unique, so re-running adds nothing.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { outlet_id } = result.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const month = monthStart(result.data.month.length === 7 ? `${result.data.month}-01` : result.data.month)

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: assets, error } = await auth.supabase.from('fixed_assets').select('*').eq('outlet_id', outlet_id).eq('status', 'active')
  if (error) return fail(error)
  const ids = (assets ?? []).map((a) => a.id)
  if (ids.length === 0) return NextResponse.json({ depreciated: 0, total: 0 })

  const { data: deps } = await auth.supabase.from('asset_depreciations').select('asset_id, period_month, amount').in('asset_id', ids)
  const accumulated = new Map<string, number>()
  const doneThisMonth = new Set<string>()
  for (const d of deps ?? []) {
    accumulated.set(d.asset_id, (accumulated.get(d.asset_id) ?? 0) + d.amount)
    if (d.period_month === month) doneThisMonth.add(d.asset_id)
  }

  const due = (assets ?? [])
    .filter((a) => !doneThisMonth.has(a.id))
    .map((a) => ({ asset: a, amount: depreciationForMonth(a, month, accumulated.get(a.id) ?? 0) }))
    .filter((d) => d.amount > 0)
  if (due.length === 0) return NextResponse.json({ depreciated: 0, total: 0 })

  const total = Math.round(due.reduce((s, d) => s + d.amount, 0) * 100) / 100
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  const { data: rows, error: insertError } = await auth.supabase
    .from('asset_depreciations')
    .insert(due.map((d) => ({ asset_id: d.asset.id, period_month: month, amount: d.amount })))
    .select('id')
  if (insertError) return fail(insertError)

  const runId = crypto.randomUUID()
  const entryId = await postJournal(auth.supabase, {
    outletId: outlet_id,
    createdBy: auth.id,
    date: lastDay,
    description: `Penyusutan aset tetap ${month.slice(0, 7)}`,
    sourceType: 'depreciation',
    sourceId: runId,
    lines: [
      { code: '5400', debit: total },
      { code: '1590', credit: total },
    ],
  })
  if (entryId && rows?.length) await auth.supabase.from('asset_depreciations').update({ journal_entry_id: entryId }).in('id', rows.map((r) => r.id))

  return NextResponse.json({ depreciated: due.length, total, journaled: !!entryId })
}
