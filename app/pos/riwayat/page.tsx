import { CashierHistory } from '@/components/pos/CashierHistory'

export default function RiwayatKasirPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-extrabold text-[var(--brand-900)]">🧾 Riwayat Kasir</h1>
      <CashierHistory />
    </div>
  )
}
