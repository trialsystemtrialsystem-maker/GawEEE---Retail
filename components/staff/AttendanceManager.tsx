'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface AttendanceRow {
  staff: { id: string; first_name: string; last_name: string | null }
  attendance: { id: string; clock_in_time: string | null; clock_out_time: string | null; status: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak Hadir',
  early_leave: 'Pulang Cepat',
  half_day: 'Setengah Hari',
}

export function AttendanceManager({ outletId }: { outletId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/attendance?outlet_id=${outletId}&date=${date}`)
    const data = await res.json()
    if (res.ok) setRows(data.rows ?? [])
    setIsLoading(false)
  }, [outletId, date])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function clockIn(staffId: string) {
    setBusyStaffId(staffId)
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mencatat kehadiran', 'danger')
        return
      }
      load()
    } finally {
      setBusyStaffId(null)
    }
  }

  async function clockOut(attendanceId: string, staffId: string) {
    setBusyStaffId(staffId)
    try {
      await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: attendanceId }),
      })
      load()
    } finally {
      setBusyStaffId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1">
        <label className="block text-sm font-medium text-gray-700">Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jam Masuk</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jam Keluar</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada karyawan aktif</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.staff.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {r.staff.first_name} {r.staff.last_name ?? ''}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.attendance?.clock_in_time ? formatDateTime(r.attendance.clock_in_time) : '-'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.attendance?.clock_out_time ? formatDateTime(r.attendance.clock_out_time) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    {r.attendance ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {STATUS_LABEL[r.attendance.status] ?? r.attendance.status}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        Belum Absen
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!r.attendance ? (
                      <button
                        onClick={() => clockIn(r.staff.id)}
                        disabled={busyStaffId === r.staff.id}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        Clock In
                      </button>
                    ) : !r.attendance.clock_out_time ? (
                      <button
                        onClick={() => clockOut(r.attendance!.id, r.staff.id)}
                        disabled={busyStaffId === r.staff.id}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        Clock Out
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">Selesai</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
