import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

const QUICK_LINKS = [
  { href: '/dashboard/accounting/accounts', icon: '📖', label: 'Chart of Accounts' },
  { href: '/dashboard/accounting/journal', icon: '🧾', label: 'Jurnal Umum' },
  { href: '/dashboard/accounting/ledger', icon: '📗', label: 'Buku Besar' },
  { href: '/dashboard/accounting/balance-sheet', icon: '⚖️', label: 'Neraca' },
  { href: '/dashboard/accounting/profit-loss', icon: '📈', label: 'Laba Rugi' },
]

export default async function AccountingDashboardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  if (!profile?.outlet_id) {
    return <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
  }

  const start = new Date()
  start.setDate(1)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = new Date().toISOString().slice(0, 10)

  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, account_type')
    .eq('outlet_id', profile.outlet_id)
    .in('account_type', ['income', 'expense'])

  const accountIds = (accounts ?? []).map((a) => a.id)
  let totalIncome = 0
  let totalExpense = 0

  if (accountIds.length > 0) {
    const { data: lines } = await supabase
      .from('journal_entry_details')
      .select('account_id, debit, credit, journal_entries!inner(entry_date, status, outlet_id)')
      .in('account_id', accountIds)
      .eq('journal_entries.outlet_id', profile.outlet_id)
      .eq('journal_entries.status', 'posted')
      .gte('journal_entries.entry_date', startStr)
      .lte('journal_entries.entry_date', endStr)

    const accountTypeById = new Map((accounts ?? []).map((a) => [a.id, a.account_type]))
    for (const line of lines ?? []) {
      const type = accountTypeById.get(line.account_id)
      if (type === 'income') totalIncome += line.credit - line.debit
      else if (type === 'expense') totalExpense += line.debit - line.credit
    }
  }

  const netProfit = totalIncome - totalExpense

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Akuntansi</h1>
        <p className="text-gray-500">Ringkasan keuangan bulan berjalan.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Pendapatan Bulan Ini</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Beban Bulan Ini</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(totalExpense)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Laba Bersih</p>
          <p className={`mt-1 text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="text-2xl">{l.icon}</span>
            <span className="font-medium text-gray-900">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
