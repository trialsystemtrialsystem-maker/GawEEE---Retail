import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { postJournal } from '@/lib/utils/journalPosting'
import { buildClosingLines, type PeriodAccountBalance } from '@/lib/utils/closingEntry'
import { selectAll } from '@/lib/utils/fetchAll'

const schema = z.object({
  outlet_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase.from('fiscal_periods').select('*').eq('outlet_id', outletId).order('period_start', { ascending: false })
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ periods: data })
}

// POST /api/accounting/periods { outlet_id, period_start, period_end } — tutup
// buku. Refuses while draft journals remain in the range or when it overlaps an
// already-closed period; posts a closing entry (income/expense -> Laba
// Ditahan, source_type 'closing') and locks the range: a DB trigger then
// rejects any new journal dated inside it until the period is reopened.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { outlet_id, period_start, period_end } = result.data
  if (!canAccessOutlet(auth, outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  if (period_end < period_start) return NextResponse.json({ error: 'Tanggal akhir harus setelah tanggal mulai' }, { status: 400 })

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: overlap } = await auth.supabase
    .from('fiscal_periods')
    .select('id')
    .eq('outlet_id', outlet_id)
    .eq('status', 'closed')
    .lte('period_start', period_end)
    .gte('period_end', period_start)
    .limit(1)
  if (overlap?.length) return NextResponse.json({ error: 'Rentang ini bertabrakan dengan periode yang sudah ditutup' }, { status: 409 })

  const { count: drafts } = await auth.supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('outlet_id', outlet_id)
    .eq('status', 'draft')
    .gte('entry_date', period_start)
    .lte('entry_date', period_end)
  if ((drafts ?? 0) > 0) return NextResponse.json({ error: `Masih ada ${drafts} jurnal draft di periode ini — posting atau hapus dulu` }, { status: 409 })

  // Period balances of income/expense accounts (excluding earlier closings).
  const { data: accounts } = await auth.supabase.from('chart_of_accounts').select('id, account_code, account_type').eq('outlet_id', outlet_id).in('account_type', ['income', 'expense'])
  const byId = new Map((accounts ?? []).map((a) => [a.id, a]))
  const balances = new Map<string, number>()
  if (byId.size) {
    const { data: lines, error: linesError } = await selectAll(auth.supabase
      .from('journal_entry_details')
      .select('account_id, debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
      .in('account_id', Array.from(byId.keys()))
      .eq('journal_entries.outlet_id', outlet_id)
      .in('journal_entries.status', ['posted', 'reversed'])
      .or('source_type.is.null,source_type.neq.closing', { referencedTable: 'journal_entries' })
      .gte('journal_entries.entry_date', period_start)
      .lte('journal_entries.entry_date', period_end))
    if (linesError) return fail(linesError)
    for (const l of lines ?? []) {
      const acc = byId.get(l.account_id)!
      const delta = acc.account_type === 'income' ? l.credit - l.debit : l.debit - l.credit
      balances.set(acc.id, (balances.get(acc.id) ?? 0) + delta)
    }
  }
  const closing = buildClosingLines(
    Array.from(balances.entries()).map(([id, balance]) => ({ account_code: byId.get(id)!.account_code, account_type: byId.get(id)!.account_type as PeriodAccountBalance['account_type'], balance }))
  )

  const { data: period, error: insertError } = await auth.supabase.from('fiscal_periods').insert({ outlet_id, period_start, period_end, status: 'open' }).select().single()
  if (insertError) return fail(insertError)

  let closingEntryId: string | null = null
  if (closing.lines.length >= 2) {
    closingEntryId = await postJournal(auth.supabase, {
      outletId: outlet_id,
      createdBy: auth.id,
      date: period_end,
      description: `Jurnal penutup ${period_start} s/d ${period_end}`,
      sourceType: 'closing',
      sourceId: period.id,
      lines: closing.lines,
    })
    if (!closingEntryId) {
      await auth.supabase.from('fiscal_periods').delete().eq('id', period.id)
      return NextResponse.json({ error: 'Gagal membuat jurnal penutup (pastikan akun 3100 Laba Ditahan ada)' }, { status: 500 })
    }
  }

  const { error: closeError } = await auth.supabase
    .from('fiscal_periods')
    .update({ status: 'closed', closing_entry_id: closingEntryId, closed_by: auth.id, closed_at: new Date().toISOString() })
    .eq('id', period.id)
  if (closeError) return fail(closeError)

  return NextResponse.json({ period_id: period.id, net_profit: closing.netProfit, closing_entry_id: closingEntryId }, { status: 201 })
}
