'use client'

import { useEffect, useState, useCallback } from 'react'
import { useNotificationStore } from '@/store/notificationStore'

interface Staff {
  id: string
  first_name: string
  last_name: string | null
  position: string
  commission_rate: number
}

export function CommissionGroupList({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/staff?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setStaff(data.staff ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function updateRate(id: string, percent: string) {
    const rate = Math.max(0, Math.min(100, Number(percent) || 0)) / 100
    setSavingId(id)
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_rate: rate }),
      })
      if (res.ok) {
        showToast('Komisi berhasil diperbarui', 'success')
        setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, commission_rate: rate } : s)))
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Jabatan</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Komisi (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
            </tr>
          ) : staff.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada karyawan</td>
            </tr>
          ) : (
            staff.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">
                  {s.first_name} {s.last_name ?? ''}
                </td>
                <td className="px-4 py-2 text-gray-600">{s.position}</td>
                <td className="px-4 py-2">
                  {canManage ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      defaultValue={Math.round(s.commission_rate * 1000) / 10}
                      disabled={savingId === s.id}
                      onBlur={(e) => updateRate(s.id, e.target.value)}
                      className="w-24 rounded-sm border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-gray-700">{Math.round(s.commission_rate * 1000) / 10}%</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
