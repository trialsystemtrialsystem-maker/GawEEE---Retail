import { LedgerView } from '@/components/accounting/LedgerView'

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Buku Besar</h1>
      <LedgerView />
    </div>
  )
}
