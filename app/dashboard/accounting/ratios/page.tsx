import { FinancialRatiosView } from '@/components/accounting/FinancialRatiosView'

export default function FinancialRatiosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rasio Keuangan</h1>
        <p className="text-gray-500">Kesehatan keuangan bisnis: likuiditas, utang, dan profitabilitas, dihitung dari Neraca dan Laba Rugi.</p>
      </div>
      <FinancialRatiosView />
    </div>
  )
}
