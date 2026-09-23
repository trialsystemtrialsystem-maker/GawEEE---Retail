import { ChartOfAccountsList } from '@/components/accounting/ChartOfAccountsList'

export default function ChartOfAccountsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
      <ChartOfAccountsList />
    </div>
  )
}
