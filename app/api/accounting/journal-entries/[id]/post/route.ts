import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/accounting/journal-entries/:id/post — manager+ only. Atomically
// re-validates the entry balances and flips it to 'posted' via
// post_journal_entry() (see 014_accounting_functions.sql).
export async function POST(_request: NextRequest, ctx: RouteContext<'/api/accounting/journal-entries/[id]/post'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data, error } = await auth.supabase.rpc('post_journal_entry', { p_entry_id: id })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ posted_date: data?.[0]?.posted_date })
}
