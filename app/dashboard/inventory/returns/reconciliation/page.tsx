import { PurchaseReturnReconciliation } from '@/components/suppliers/PurchaseReturnReconciliation'

export default function PurchaseReturnReconciliationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase Return Reconciliation</h1>
        <p className="text-gray-500">Berapa yang masih harus dibayar ke supplier setelah dikurangi retur.</p>
      </div>
      <PurchaseReturnReconciliation />
    </div>
  )
}
