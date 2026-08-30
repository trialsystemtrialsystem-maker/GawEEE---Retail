'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
}

interface StaffOption {
  id: string
  first_name: string
  last_name: string | null
}

interface ScheduleEntry {
  staff_id: string
  work_date: string
  shifts: { name: string } | null
  shift_id: string
}

function startOfWeek(d = new Date()) {
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ScheduleManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek())
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [shiftForm, setShiftForm] = useState({ name: '', start_time: '08:00', end_time: '16:00' })
  const showToast = useNotificationStore((s) => s.show)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  }), [weekStart])

  const load = useCallback(async () => {
    const start = toDateStr(weekStart)
    const end = toDateStr(weekDays[6])
    const [shiftsRes, staffRes, schedulesRes] = await Promise.all([
      fetch(`/api/shifts?outlet_id=${outletId}`),
      fetch(`/api/staff?outlet_id=${outletId}`),
      fetch(`/api/staff-schedules?outlet_id=${outletId}&start=${start}&end=${end}`),
    ])
    const shiftsData = await shiftsRes.json()
    const staffData = await staffRes.json()
    const schedulesData = await schedulesRes.json()
    if (shiftsRes.ok) setShifts(shiftsData.shifts ?? [])
    if (staffRes.ok) setStaff(staffData.staff ?? [])
    if (schedulesRes.ok) setSchedules(schedulesData.schedules ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, weekStart])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shiftForm, outlet_id: outletId }),
    })
    if (res.ok) {
      showToast('Shift berhasil ditambahkan', 'success')
      setShiftForm({ name: '', start_time: '08:00', end_time: '16:00' })
      setShowShiftForm(false)
      load()
    }
  }

  async function assign(staffId: string, workDate: string, shiftId: string) {
    if (!shiftId) return
    const res = await fetch('/api/staff-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: staffId, shift_id: shiftId, work_date: workDate }),
    })
    if (res.ok) load()
  }

  function scheduleFor(staffId: string, workDate: string) {
    return schedules.find((s) => s.staff_id === staffId && s.work_date === workDate)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Shift</h2>
          {canManage && (
            <Button size="sm" onClick={() => setShowShiftForm((v) => !v)}>
              {showShiftForm ? 'Batal' : '+ Tambah Shift'}
            </Button>
          )}
        </div>
        {showShiftForm && (
          <form onSubmit={handleAddShift} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-4">
            <Input
              label="Nama Shift"
              required
              placeholder="Pagi"
              value={shiftForm.name}
              onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Mulai"
              type="time"
              required
              value={shiftForm.start_time}
              onChange={(e) => setShiftForm((f) => ({ ...f, start_time: e.target.value }))}
            />
            <Input
              label="Selesai"
              type="time"
              required
              value={shiftForm.end_time}
              onChange={(e) => setShiftForm((f) => ({ ...f, end_time: e.target.value }))}
            />
            <div className="flex items-end">
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          {shifts.map((s) => (
            <span key={s.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {s.name} ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Jadwal Kerja Karyawan</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n })}
              className="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
            >
              ← Minggu Lalu
            </button>
            <button
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n })}
              className="rounded-md border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Minggu Depan →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Karyawan</th>
                {weekDays.map((d) => (
                  <th key={d.toISOString()} className="px-2 py-2 text-center font-semibold text-gray-600">
                    {formatDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">Belum ada karyawan</td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-gray-900">
                      {s.first_name} {s.last_name ?? ''}
                    </td>
                    {weekDays.map((d) => {
                      const dateStr = toDateStr(d)
                      const entry = scheduleFor(s.id, dateStr)
                      return (
                        <td key={dateStr} className="px-2 py-2 text-center">
                          {canManage ? (
                            <select
                              value={entry?.shift_id ?? ''}
                              onChange={(e) => assign(s.id, dateStr, e.target.value)}
                              className="rounded-sm border border-gray-200 px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {shifts.map((sh) => (
                                <option key={sh.id} value={sh.id}>
                                  {sh.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-600">{entry?.shifts?.name ?? '-'}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
