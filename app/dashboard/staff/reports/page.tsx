import { EmployeeReports } from '@/components/staff/EmployeeReports'

export default function EmployeeReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Karyawan</h1>
        <p className="text-gray-500">Ringkasan per karyawan untuk satu periode: kehadiran, keterlambatan, cuti, insentif, kasbon, dan gaji. Klik nama untuk riwayat lengkap.</p>
      </div>
      <EmployeeReports />
    </div>
  )
}
