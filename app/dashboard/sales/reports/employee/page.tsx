import { EmployeeReport } from '@/components/sales/EmployeeReport'

export default function EmployeeReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Report</h1>
        <p className="text-gray-500">Kinerja penjualan per karyawan.</p>
      </div>
      <EmployeeReport />
    </div>
  )
}
