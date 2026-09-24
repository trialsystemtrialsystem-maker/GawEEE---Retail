'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { formatDuration } from '@/lib/utils/employeeHistory'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface Row {
  staff_id: string
  name: string
  position: string
  present_days: number
  absent_days: number
  late_days: number
  late_minutes: number
  cuti_days: number
  sakit_days: number
  izin_days: number
  libur_days: number
  incentive_total: number
  kasbon_outstanding: number
  net_pay_paid: number
}

export function EmployeeReports() {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!outletId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/staff/reports?outlet_id=${outletId}&start=${range.start}&end=${range.end}`)
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memuat laporan')
        return
      }
      setRows(data.rows ?? [])
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [outletId, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const csvRows = rows.map((r) => ({
    Karyawan: r.name,
    Jabatan: r.position,
    Hadir: r.present_days,
    Absen: r.absent_days,
    'Hari Terlambat': r.late_days,
    'Menit Terlambat': r.late_minutes,
    Cuti: r.cuti_days,
    Sakit: r.sakit_days,
    Izin: r.izin_days,
    Libur: r.libur_days,
    Insentif: r.incentive_total,
    'Kasbon Berjalan': r.kasbon_outstanding,
    'Gaji Bersih Dibayar': r.net_pay_paid,
  }))

  const th = 'px-3 py-2 font-semibold text-gray-600'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <DateRangePicker value={range} onChange={setRange} />
        <ExportCsvButton filename={`riwayat-karyawan-${range.start}_${range.end}`} rows={csvRows} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>Karyawan</th>
              <th className={`${th} text-right`}>Hadir</th>
              <th className={`${th} text-right`}>Absen</th>
              <th className={`${th} text-right`}>Terlambat</th>
              <th className={`${th} text-right`}>Cuti</th>
              <th className={`${th} text-right`}>Sakit</th>
              <th className={`${th} text-right`}>Izin</th>
              <th className={`${th} text-right`}>Libur</th>
              <th className={`${th} text-right`}>Insentif</th>
              <th className={`${th} text-right`}>Kasbon Berjalan</th>
              <th className={`${th} text-right`}>Gaji Bersih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-400">Belum ada karyawan aktif di outlet ini</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.staff_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/staff/${r.staff_id}`} className="font-medium text-brand-600 hover:underline">{r.name}</Link>
                    <p className="text-xs text-gray-400">{r.position}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.present_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.absent_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {r.late_days} <span className="text-xs text-gray-400">({r.late_minutes ? formatDuration(r.late_minutes) : '-'})</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.cuti_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.sakit_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.izin_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{r.libur_days}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.incentive_total)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.kasbon_outstanding)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(r.net_pay_paid)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
