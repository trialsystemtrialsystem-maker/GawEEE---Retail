import { KitchenBoard } from '@/components/sales/KitchenBoard'

export default function KitchenReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kitchen Report</h1>
        <p className="text-gray-500">Antrean layanan hari ini — ketuk untuk memajukan status.</p>
      </div>
      <KitchenBoard />
    </div>
  )
}
