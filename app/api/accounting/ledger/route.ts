import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense'])

// GET /api/accounting/ledger?outlet_id=&account_id= — buku besar: every
// posted line for one account, in date order, with a running balance. Sign
// convention: asset/expense accounts increase on debit, liability/equity/
// income accounts increase on credit.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const accountId = searchParams.get('account_id')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }
  if (!accountId) {
    return NextResponse.json({ error: 'account_id wajib diisi' }, { status: 400 })
  }

  const { data: account, error: accountError } = await auth.supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type')
    .eq('id', accountId)
    .single()

  if (accountError) {
    const { status, message } = handleDatabaseError(accountError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: lines, error } = await auth.supabase
    .from('journal_entry_details')
    .select('debit, credit, description, journal_entries!inner(id, entry_date, description, status, outlet_id)')
    .eq('account_id', accountId)
    .eq('journal_entries.outlet_id', outletId)
    .eq('journal_entries.status', 'posted')
    .order('entry_date', { referencedTable: 'journal_entries', ascending: true })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.account_type)
  let balance = 0
  const rows = (lines ?? []).map((l) => {
    const je = Array.isArray(l.journal_entries) ? l.journal_entries[0] : l.journal_entries
    const delta = isDebitNormal ? l.debit - l.credit : l.credit - l.debit
    balance += delta
    return {
      entry_id: je?.id,
      entry_date: je?.entry_date,
      description: l.description || je?.description,
      debit: l.debit,
      credit: l.credit,
      balance,
    }
  })

  return NextResponse.json({ account, rows, ending_balance: balance })
}
