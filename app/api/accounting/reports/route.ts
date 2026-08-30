import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

type AccountRow = { id: string; account_code: string; account_name: string; account_type: string }
type LineRow = { account_id: string; debit: number; credit: number; journal_entries: { entry_date: string } | { entry_date: string }[] }

function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

// GET /api/accounting/reports?outlet_id=&type=profit-loss|balance-sheet&start=&end=&as_of=
// profit-loss: sums posted income/expense lines within [start, end] (default: current month).
// balance-sheet: sums ALL posted asset/liability/equity lines up to as_of (default: today) —
// a cumulative balance, not forced to reconcile (retained earnings only reflects prior
// manually-posted closing entries, same as any manual-bookkeeping tool at this stage).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const type = searchParams.get('type')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }
  if (type !== 'profit-loss' && type !== 'balance-sheet') {
    return NextResponse.json({ error: 'type harus profit-loss atau balance-sheet' }, { status: 400 })
  }

  const accountTypes: Array<'asset' | 'liability' | 'equity' | 'income' | 'expense'> =
    type === 'profit-loss' ? ['income', 'expense'] : ['asset', 'liability', 'equity']

  const { data: accounts, error: accountsError } = await auth.supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type')
    .eq('outlet_id', outletId)
    .in('account_type', accountTypes)
    .order('account_code')

  if (accountsError) {
    const { status, message } = handleDatabaseError(accountsError)
    return NextResponse.json({ error: message }, { status })
  }

  const accountIds = (accounts as AccountRow[]).map((a) => a.id)
  if (accountIds.length === 0) {
    return NextResponse.json(type === 'profit-loss' ? emptyProfitLoss() : emptyBalanceSheet())
  }

  let query = auth.supabase
    .from('journal_entry_details')
    .select('account_id, debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
    .in('account_id', accountIds)
    .eq('journal_entries.outlet_id', outletId)
    .eq('journal_entries.status', 'posted')

  if (type === 'profit-loss') {
    const start = searchParams.get('start') ?? firstDayOfMonth()
    const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
    query = query.gte('journal_entries.entry_date', start).lte('journal_entries.entry_date', end)
  } else {
    const asOf = searchParams.get('as_of') ?? new Date().toISOString().slice(0, 10)
    query = query.lte('journal_entries.entry_date', asOf)
  }

  const { data: lines, error: linesError } = await query
  if (linesError) {
    const { status, message } = handleDatabaseError(linesError)
    return NextResponse.json({ error: message }, { status })
  }

  const balanceByAccount = new Map<string, number>()
  for (const line of (lines ?? []) as unknown as LineRow[]) {
    const account = (accounts as AccountRow[]).find((a) => a.id === line.account_id)
    if (!account) continue
    const debitNormal = account.account_type === 'expense' || account.account_type === 'asset'
    const delta = debitNormal ? line.debit - line.credit : line.credit - line.debit
    balanceByAccount.set(account.id, (balanceByAccount.get(account.id) ?? 0) + delta)
  }

  const withBalances = (accounts as AccountRow[]).map((a) => ({
    ...a,
    balance: balanceByAccount.get(a.id) ?? 0,
  }))

  if (type === 'profit-loss') {
    const income = withBalances.filter((a) => a.account_type === 'income')
    const expense = withBalances.filter((a) => a.account_type === 'expense')
    const totalIncome = income.reduce((s, a) => s + a.balance, 0)
    const totalExpense = expense.reduce((s, a) => s + a.balance, 0)
    return NextResponse.json({ income, expense, totalIncome, totalExpense, netProfit: totalIncome - totalExpense })
  }

  const asset = withBalances.filter((a) => a.account_type === 'asset')
  const liability = withBalances.filter((a) => a.account_type === 'liability')
  const equity = withBalances.filter((a) => a.account_type === 'equity')
  const totalAsset = asset.reduce((s, a) => s + a.balance, 0)
  const totalLiability = liability.reduce((s, a) => s + a.balance, 0)
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0)
  return NextResponse.json({
    asset,
    liability,
    equity,
    totalAsset,
    totalLiability,
    totalEquity,
    isBalanced: totalAsset === totalLiability + totalEquity,
  })
}

function emptyProfitLoss() {
  return { income: [], expense: [], totalIncome: 0, totalExpense: 0, netProfit: 0 }
}

function emptyBalanceSheet() {
  return {
    asset: [],
    liability: [],
    equity: [],
    totalAsset: 0,
    totalLiability: 0,
    totalEquity: 0,
    isBalanced: true,
  }
}
