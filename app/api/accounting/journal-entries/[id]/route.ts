import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/accounting/journal-entries/:id — entry + its line items, RLS-scoped.
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/accounting/journal-entries/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: entry, error: entryError } = await auth.supabase
    .from('journal_entries')
    .select('*')
    .eq('id', id)
    .single()

  if (entryError) {
    const { status, message } = handleDatabaseError(entryError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: lines, error: linesError } = await auth.supabase
    .from('journal_entry_details')
    .select('*, chart_of_accounts(account_code, account_name)')
    .eq('journal_entry_id', id)

  if (linesError) {
    const { status, message } = handleDatabaseError(linesError)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ entry, lines })
}
