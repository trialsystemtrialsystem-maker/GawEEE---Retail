'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDate } from '@/lib/utils/formatting'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface AttendanceRow {
  id: string
  attendance_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = { present: 'Hadir', late: 'Terlambat', absent: 'Absen', early_leave: 'Pulang Awal', half_day: 'Setengah Hari' }
const STATUS_COLOR: Record<string, string> = {
  present: 'bg-[var(--status-good)]/10 text-[var(--status-good)]',
  late: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]',
  absent: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
}

export function SelfAttendance() {
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string | null } | null>(null)
  const [today, setToday] = useState<AttendanceRow | null>(null)
  const [history, setHistory] = useState<AttendanceRow[]>([])
  const [notLinked, setNotLinked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/attendance/me')
    const data = await res.json()
    if (res.ok) {
      setStaff(data.staff)
      setToday(data.today)
      setHistory(data.history ?? [])
      setNotLinked(false)
    } else if (res.status === 404) {
      setNotLinked(true)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleClockIn() {
    if (!staff) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staff.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal absen masuk', 'danger')
        return
      }
      showToast('Absen masuk berhasil', 'success')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClockOut() {
    if (!today) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: today.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal absen pulang', 'danger')
        return
      }
      showToast('Absen pulang berhasil', 'success')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>
  if (notLinked) {
    return <Alert variant="warning">Akun Anda belum ditautkan ke data staff. Hubungi manager untuk menautkan akun ini ke daftar karyawan.</Alert>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] p-6 text-center text-white shadow-lg">
        <p className="text-sm text-white/80">{staff?.first_name} {staff?.last_name ?? ''}</p>
        <p className="mt-1 text-3xl font-extrabold">
          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm text-white/80">{formatDate(new Date().toISOString())}</p>

        {!today ? (
          <button
            type="button"
            onClick={handleClockIn}
            disabled={isSubmitting}
            className="mt-4 w-full rounded-xl bg-white py-3 text-lg font-bold text-[var(--brand-700)] shadow-md transition hover:bg-white/90 disabled:opacity-50"
          >
            🕒 Absen Masuk
          </button>
        ) : !today.clock_out_time ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-white/90">
              Masuk: {new Date(today.clock_in_time!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              type="button"
              onClick={handleClockOut}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-white py-3 text-lg font-bold text-[var(--brand-700)] shadow-md transition hover:bg-white/90 disabled:opacity-50"
            >
              🚪 Absen Pulang
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-white/20 py-3 text-sm font-semibold">
            ✅ Selesai — Masuk {new Date(today.clock_in_time!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}, Pulang{' '}
            {new Date(today.clock_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--brand-100)] bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-[var(--brand-700)]">Riwayat 7 Hari Terakhir</h3>
        <ul className="divide-y divide-gray-100">
          {history.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">Belum ada riwayat absensi</li>
          ) : (
            history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-600">{formatDate(h.attendance_date)}</span>
                <span className="text-gray-500">
                  {h.clock_in_time ? new Date(h.clock_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  {' – '}
                  {h.clock_out_time ? new Date(h.clock_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[h.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[h.status] ?? h.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
