'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Promotion {
  id: string
  name: string
  discount_type: string
  discount_value: number
  start_date: string
  end_date: string
  is_active: boolean
}

export function PromotionManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', discount_type: 'percentage', discount_value: '', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10) })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/promotions?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setPromotions(data.promotions ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, discount_value: Number(form.discount_value) }),
      })
      if (res.ok) {
        showToast('Promosi berhasil dibuat', 'success')
        setForm({ name: '', discount_type: 'percentage', discount_value: '', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10) })
        setShowForm(false)
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleActive(p: Promotion) {
    const res = await fetch(`/api/promotions/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Promosi'}
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input label="Nama Promosi" required placeholder="Diskon Akhir Pekan" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
            <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <Input label="Nilai Diskon" type="number" min="0" required value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
          <Input label="Mulai" type="date" required value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Input label="Selesai" type="date" required value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Diskon</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Periode</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              {canManage && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : promotions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada promosi</td>
              </tr>
            ) : (
              promotions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{p.name}</td>
                  <td className="px-4 py-2 text-gray-700">{p.discount_type === 'percentage' ? `${p.discount_value}%` : `Rp ${p.discount_value.toLocaleString('id-ID')}`}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(p.start_date)} - {formatDate(p.end_date)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2">
                      <button onClick={() => toggleActive(p)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
