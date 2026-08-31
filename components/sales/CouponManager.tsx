'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Coupon {
  id: string
  code: string
  discount_type: string
  discount_value: number
  usage_limit: number | null
  usage_count: number
  expires_at: string | null
  is_active: boolean
}

export function CouponManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', usage_limit: '', expires_at: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/coupons?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setCoupons(data.coupons ?? [])
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
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          code: form.code.toUpperCase(),
          outlet_id: outletId,
          discount_value: Number(form.discount_value),
          usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
          expires_at: form.expires_at || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal membuat kupon', 'danger')
        return
      }
      showToast('Kupon berhasil dibuat', 'success')
      setForm({ code: '', discount_type: 'percentage', discount_value: '', usage_limit: '', expires_at: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Kupon'}
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input label="Kode Kupon" required placeholder="HEMAT10" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
            <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <Input label="Nilai Diskon" type="number" min="0" required value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
          <Input label="Batas Pemakaian (opsional)" type="number" min="1" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} />
          <Input label="Kadaluarsa (opsional)" type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kode</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Diskon</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pemakaian</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kadaluarsa</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada kupon</td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-900">{c.code}</td>
                  <td className="px-4 py-2 text-gray-700">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `Rp ${c.discount_value.toLocaleString('id-ID')}`}</td>
                  <td className="px-4 py-2 text-gray-600">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                  <td className="px-4 py-2 text-gray-600">{c.expires_at ? formatDate(c.expires_at) : '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
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
