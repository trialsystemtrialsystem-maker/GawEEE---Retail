import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/accounting/periods/:id/reopen — buka kembali periode. The closing
// entry is reversed with a mirror entry (both source_type 'closing', which the
// P&L ignores and the reports count, so they net to zero), then the period is
// unlocked. Only master_admin/managers with journal.post may do this.
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/accounting/periods/[id]/reopen'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const { data: period } = await auth.supabase.from('fiscal_periods').select('*').eq('id', id).single()
  if (!period) return NextResponse.json({ error: 'Periode tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, period.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  if (period.status !== 'closed') return NextResponse.json({ error: 'Periode ini belum ditutup' }, { status: 409 })

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  // Unlock first so the mirror entry (dated inside the period) is not blocked.
  const { error: unlockError } = await auth.supabase.from('fiscal_periods').update({ status: 'open' }).eq('id', id)
  if (unlockError) return fail(unlockError)

  if (period.closing_entry_id) {
    const { data: lines } = await auth.supabase.from('journal_entry_details').select('account_id, debit, credit, description').eq('journal_entry_id', period.closing_entry_id)
    if (lines?.length) {
      const { data: created, error: createError } = await auth.supabase
        .rpc('create_journal_entry', {
          p_outlet_id: period.outlet_id,
          p_created_by: auth.authUserId,
          p_entry_date: period.period_end,
          p_description: `Pembatalan jurnal penutup ${period.period_start} s/d ${period.period_end}`,
          p_lines: lines.map((l) => ({ account_id: l.account_id, debit: l.credit, credit: l.debit, description: l.description })),
          p_source_type: 'closing',
          p_source_id: crypto.randomUUID(),
        })
        .single()
      const mirrorId = (created as { journal_entry_id: string } | null)?.journal_entry_id
      if (createError || !mirrorId) {
        await auth.supabase.from('fiscal_periods').update({ status: 'closed' }).eq('id', id)
        return fail(createError ?? { message: 'Gagal membalik jurnal penutup' })
      }
      await auth.supabase.rpc('post_journal_entry', { p_entry_id: mirrorId })
      await auth.supabase.from('journal_entries').update({ status: 'reversed', reversed_date: new Date().toISOString(), reversal_reason: 'Periode dibuka kembali' }).eq('id', period.closing_entry_id)
    }
  }

  await auth.supabase.from('fiscal_periods').update({ closing_entry_id: null, closed_by: null, closed_at: null }).eq('id', id)
  return NextResponse.json({ ok: true })
}
