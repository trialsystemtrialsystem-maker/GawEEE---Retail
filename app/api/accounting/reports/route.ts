import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet, type AuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'

type AccountRow = { id: string; account_code: string; account_name: string; account_type: string }
type LineRow = { account_id: string; debit: number; credit: number; journal_entries: { entry_date: string } | { entry_date: string }[] }

function firstDayOfMonth(d = new Date()) {
  // UTC-safe — journal_entries.entry_date is a plain date column compared
  // against these YYYY-MM-DD strings, so a local-timezone month boundary
  // (the old new Date(d.getFullYear(), d.getMonth(), 1)) could point at the
  // wrong month depending on the server's local timezone.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// GET /api/accounting/reports?outlet_id=&type=profit-loss|balance-sheet|trial-balance&start=&end=&as_of=
// profit-loss: sums posted income/expense lines within [start, end] (default: current month).
// balance-sheet: sums ALL posted asset/liability/equity lines up to as_of (default: today) —
// a cumulative balance, not forced to reconcile (retained earnings only reflects prior
// manually-posted closing entries, same as any manual-bookkeeping tool at this stage).
// trial-balance: every account (all 5 types), same cumulative-to-as_of balance as balance-sheet
// but including income/expense too — see todo.md Phase 31.
// (type=cash-flow is handled separately below, in its own branch — different shape entirely.)
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const type = searchParams.get('type')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }
  if (type === 'cash-flow') return getCashFlow(auth, outletId, searchParams)
  if (type !== 'profit-loss' && type !== 'balance-sheet' && type !== 'trial-balance') {
    return NextResponse.json({ error: 'type harus profit-loss, balance-sheet, trial-balance, atau cash-flow' }, { status: 400 })
  }

  const accountTypes: Array<'asset' | 'liability' | 'equity' | 'income' | 'expense'> =
    type === 'profit-loss' ? ['income', 'expense'] : type === 'balance-sheet' ? ['asset', 'liability', 'equity', 'income', 'expense'] : ['asset', 'liability', 'equity', 'income', 'expense']

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
    return NextResponse.json(type === 'profit-loss' ? emptyProfitLoss() : type === 'balance-sheet' ? emptyBalanceSheet() : emptyTrialBalance())
  }

  let query = auth.supabase
    .from('journal_entry_details')
    .select('account_id, debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
    .in('account_id', accountIds)
    .eq('journal_entries.outlet_id', outletId)
    .in('journal_entries.status', ['posted', 'reversed'])

  if (type === 'profit-loss') {
    const start = searchParams.get('start') ?? firstDayOfMonth()
    const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
    query = query.gte('journal_entries.entry_date', start).lte('journal_entries.entry_date', end)
    // Year-end closing entries just move profit to Laba Ditahan; the P&L must keep
    // showing the operating income/expense they zeroed out.
    query = query.or('source_type.is.null,source_type.neq.closing', { referencedTable: 'journal_entries' })
  } else {
    const asOf = searchParams.get('as_of') ?? new Date().toISOString().slice(0, 10)
    query = query.lte('journal_entries.entry_date', asOf)
  }

  // Journal lines routinely exceed 1000 rows; page them or every report silently
  // sums only the first thousand.
  const { data: lines, error: linesError } = await selectAll(query)
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

  if (type === 'trial-balance') {
    // create_journal_entry()/post_journal_entry() (014_accounting_functions.sql)
    // hard-enforce debit=credit at the DB level before allowing a draft or a
    // post, so the grand total is guaranteed to balance BY CONSTRUCTION —
    // but only if each account's balance lands in the column matching the
    // SIGN of its computed value, not mechanically "assets/expenses always
    // Debit, everything else always Credit" regardless of sign. An account
    // that's gone the "wrong way" (e.g. a credit-balance receivable from an
    // overpayment) must flip columns here, or the two-column total would
    // silently stop matching even though the ledger itself is fine.
    const rows = withBalances.map((a) => {
      const debitNormal = a.account_type === 'expense' || a.account_type === 'asset'
      const onNormalSide = a.balance >= 0
      const debit = debitNormal ? (onNormalSide ? a.balance : 0) : onNormalSide ? 0 : -a.balance
      const credit = debitNormal ? (onNormalSide ? 0 : -a.balance) : onNormalSide ? a.balance : 0
      return { ...a, debit, credit }
    })
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
    return NextResponse.json({
      accounts: rows,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    })
  }

  const asset = withBalances.filter((a) => a.account_type === 'asset')
  const liability = withBalances.filter((a) => a.account_type === 'liability')
  // Income/expense accounts that have not been closed to Laba Ditahan yet are
  // still part of owners' equity: show them as a computed 'Laba (Rugi) Berjalan'
  // line so the balance sheet balances without a manual closing entry. Once a
  // period is closed the income/expense balances are zero and this drops to 0,
  // so nothing is counted twice.
  const currentEarnings = withBalances.filter((a) => a.account_type === 'income').reduce((s, a) => s + a.balance, 0) - withBalances.filter((a) => a.account_type === 'expense').reduce((s, a) => s + a.balance, 0)
  const equity: typeof withBalances = [
    ...withBalances.filter((a) => a.account_type === 'equity'),
    ...(Math.abs(currentEarnings) >= 0.005 ? [{ id: 'current-earnings', account_code: '-', account_name: 'Laba (Rugi) Berjalan', account_type: 'equity', balance: currentEarnings } as (typeof withBalances)[number]] : []),
  ]
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
    isBalanced: Math.abs(totalAsset - (totalLiability + totalEquity)) < 0.01,
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

function emptyTrialBalance() {
  return { accounts: [], total_debit: 0, total_credit: 0, is_balanced: true }
}

function emptyCashFlow(period: { start: string; end: string }) {
  return { period, opening_balance: 0, closing_balance: 0, net_change: 0, by_activity: [] }
}

type CashLineRow = { debit: number; credit: number; journal_entries: { source_type: string | null } | { source_type: string | null }[] }

// Direct-method cash flow, deliberately scoped and disclosed as such — see
// todo.md Phase 31. There's no per-account cash-flow-activity classification
// in the schema (no Operating/Investing/Financing tagging anywhere), so this
// doesn't pretend at a formal IAS 7 statement: it sums every posted line
// touching Kas (1000) or Bank (1010) in the period and groups the net
// movement by journal_entries.source_type as an honest activity label
// instead. A manual internal transfer between Kas and Bank (if one is ever
// journaled) needs no special-case exclusion — its two legs are equal and
// opposite deltas landing in the SAME source_type group, so they cancel out
// there on their own; only a genuine external-facing line (the other leg of
// which is outside this Kas/Bank query entirely) contributes net movement.
async function getCashFlow(auth: AuthContext, outletId: string, searchParams: URLSearchParams) {
  const start = searchParams.get('start') ?? firstDayOfMonth()
  const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10)
  const period = { start, end }

  const { data: cashAccounts, error: accountsError } = await auth.supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('outlet_id', outletId)
    .in('account_code', ['1000', '1010'])

  if (accountsError) {
    const { status, message } = handleDatabaseError(accountsError)
    return NextResponse.json({ error: message }, { status })
  }

  const cashAccountIds = (cashAccounts ?? []).map((a) => a.id)
  if (cashAccountIds.length === 0) return NextResponse.json(emptyCashFlow(period))

  const [openingRes, periodRes] = await Promise.all([
    selectAll(auth.supabase
      .from('journal_entry_details')
      .select('debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
      .in('account_id', cashAccountIds)
      .eq('journal_entries.outlet_id', outletId)
      .in('journal_entries.status', ['posted', 'reversed'])
      .lt('journal_entries.entry_date', start)),
    selectAll(auth.supabase
      .from('journal_entry_details')
      .select('debit, credit, journal_entries!inner(entry_date, status, outlet_id, source_type)')
      .in('account_id', cashAccountIds)
      .eq('journal_entries.outlet_id', outletId)
      .in('journal_entries.status', ['posted', 'reversed'])
      .gte('journal_entries.entry_date', start)
      .lte('journal_entries.entry_date', end)),
  ])

  if (openingRes.error || periodRes.error) {
    const { status, message } = handleDatabaseError((openingRes.error ?? periodRes.error)!)
    return NextResponse.json({ error: message }, { status })
  }

  // Kas/Bank are both asset (debit-normal) accounts.
  const openingBalance = (openingRes.data ?? []).reduce((s, l) => s + (l.debit - l.credit), 0)

  const bySource = new Map<string, number>()
  let netChange = 0
  for (const line of (periodRes.data ?? []) as unknown as CashLineRow[]) {
    const je = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries
    const delta = line.debit - line.credit
    netChange += delta
    const key = je?.source_type || 'manual'
    bySource.set(key, (bySource.get(key) ?? 0) + delta)
  }

  return NextResponse.json({
    period,
    opening_balance: openingBalance,
    closing_balance: openingBalance + netChange,
    net_change: netChange,
    by_activity: Array.from(bySource.entries())
      .map(([source_type, amount]) => ({ source_type, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  })
}
