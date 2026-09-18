'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils/formatting'
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

interface Redemption {
  id: string
  discount_amount: number
  created_at: string
  invoices: { invoice_number: string; total: number; order_status: string } | null
}

export function CouponManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', usage_limit: '', expires_at: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedCouponId, setExpandedCouponId] = useState<string | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  async function toggleRedemptions(couponId: string) {
    if (expandedCouponId === couponId) {
      setExpandedCouponId(null)
      return
    }
    setExpandedCouponId(couponId)
    setIsLoadingRedemptions(true)
    try {
      const res = await fetch(`/api/coupon-redemptions?coupon_id=${couponId}`)
      const data = await res.json()
      setRedemptions(res.ok ? (data.redemptions ?? []) : [])
    } finally {
      setIsLoadingRedemptions(false)
    }
  }

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
          <Input name="coupon_code" label="Kode Kupon" required placeholder="HEMAT10" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
            <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <Input name="discount_value" label="Nilai Diskon" type="number" min="0" required value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} />
          <Input name="usage_limit" label="Batas Pemakaian (opsional)" type="number" min="1" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} />
          <Input name="expires_at" label="Kadaluarsa (opsional)" type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
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
                <Fragment key={c.id}>
                  <tr onClick={() => toggleRedemptions(c.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-900">{c.code}</td>
                    <td className="px-4 py-2 text-gray-700">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `Rp ${c.discount_value.toLocaleString('id-ID')}`}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {c.usage_count}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ''} <span className="text-xs text-brand-500">(lihat rincian)</span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c.expires_at ? formatDate(c.expires_at) : '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                  </tr>
                  {expandedCouponId === c.id && (
                    <tr>
                      <td colSpan={5} className="bg-gray-50 px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-gray-500">Rincian Pemakaian — {c.code}</p>
                        {isLoadingRedemptions ? (
                          <p className="text-xs text-gray-400">Memuat…</p>
                        ) : redemptions.length === 0 ? (
                          <p className="text-xs text-gray-400">Belum ada transaksi yang memakai kupon ini.</p>
                        ) : (
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-1 pr-4">Invoice</th>
                                <th className="py-1 pr-4">Waktu</th>
                                <th className="py-1 pr-4 text-right">Diskon</th>
                                <th className="py-1 pr-4 text-right">Total Invoice</th>
                                <th className="py-1 pr-4">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {redemptions.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-1 pr-4 font-mono text-gray-800">{r.invoices?.invoice_number ?? '-'}</td>
                                  <td className="py-1 pr-4 text-gray-600">{formatDateTime(r.created_at)}</td>
                                  <td className="py-1 pr-4 text-right text-gray-700">{formatCurrency(r.discount_amount)}</td>
                                  <td className="py-1 pr-4 text-right text-gray-700">{r.invoices ? formatCurrency(r.invoices.total) : '-'}</td>
                                  <td className="py-1 pr-4 text-gray-600">{r.invoices?.order_status === 'voided' ? 'Dibatalkan' : 'Selesai'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
