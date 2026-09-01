import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/expense-requests/:id/pay { payment_method: 'cash' | 'bank_transfer' } —
// manager+ only. Marks an approved request as actually disbursed and, best
// effort, posts a journal entry (debit Beban Operasional / credit Kas or
// Bank) via the existing create_journal_entry()+post_journal_entry() —
// additive calls, no function changes. The journal post is optional: if the
// outlet's default chart of accounts was ever renamed/deleted, paying the
// expense still succeeds (matches the low-stakes trade-off already used for
// PO receiving elsewhere in this codebase) — it just won't have a matching
// journal entry.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/expense-requests/[id]/pay'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const paymentMethod = body.payment_method === 'bank_transfer' ? 'bank_transfer' : 'cash'

  const { data: expense, error } = await auth.supabase
    .from('expense_requests')
    .update({ paid_at: new Date().toISOString(), payment_method: paymentMethod })
    .eq('id', id)
    .eq('status', 'approved')
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: accounts } = await auth.supabase
    .from('chart_of_accounts')
    .select('id, account_code')
    .eq('outlet_id', expense.outlet_id)
    .in('account_code', ['5200', paymentMethod === 'bank_transfer' ? '1010' : '1000'])

  const expenseAccount = accounts?.find((a) => a.account_code === '5200')
  const cashAccount = accounts?.find((a) => a.account_code === (paymentMethod === 'bank_transfer' ? '1010' : '1000'))

  let journalEntryId: string | null = null
  if (expenseAccount && cashAccount) {
    const { data: journal } = await auth.supabase
      .rpc('create_journal_entry', {
        p_outlet_id: expense.outlet_id,
        p_created_by: auth.id,
        p_entry_date: new Date().toISOString().slice(0, 10),
        p_description: `Kas Kecil: ${expense.description}`,
        p_lines: [
          { account_id: expenseAccount.id, debit: expense.amount, credit: 0 },
          { account_id: cashAccount.id, debit: 0, credit: expense.amount },
        ],
        p_source_type: 'expense_request',
        p_source_id: id,
      })
      .single()
    if (journal?.journal_entry_id) {
      journalEntryId = journal.journal_entry_id
      await auth.supabase.rpc('post_journal_entry', { p_entry_id: journalEntryId })
    }
  }

  return NextResponse.json({ request: expense, journal_entry_id: journalEntryId })
}
