'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'
import { promoStatus, PROMO_STATUS_LABEL, generateCouponCode, type PromoStatus } from '@/lib/utils/promoRules'

interface Coupon {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  usage_limit: number | null
  usage_count: number
  starts_at: string | null
  expires_at: string | null
  min_purchase: number
  max_discount: number | null
  description: string | null
  is_active: boolean
}

interface Redemption {
  id: string
  discount_amount: number
  created_at: string
  invoices: { invoice_number: string; total: number; order_status: string } | null
}

const STATUS_STYLE: Record<PromoStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-sky-50 text-sky-700',
  expired: 'bg-gray-100 text-gray-500',
  inactive: 'bg-gray-100 text-gray-500',
  exhausted: 'bg-amber-50 text-amber-700',
}

const emptyForm = () => ({ code: '', discount_type: 'percentage', discount_value: '', usage_limit: '', starts_at: '', expires_at: '', min_purchase: '', max_discount: '', description: '' })
type Form = ReturnType<typeof emptyForm>

export function CouponManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [filter, setFilter] = useState<'all' | PromoStatus>('all')
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

  function openForm(c?: Coupon) {
    setEditingId(c?.id ?? null)
    setForm(
      c
        ? {
            code: c.code,
            discount_type: c.discount_type,
            discount_value: String(c.discount_value),
            usage_limit: c.usage_limit ? String(c.usage_limit) : '',
            starts_at: c.starts_at ?? '',
            expires_at: c.expires_at ?? '',
            min_purchase: c.min_purchase ? String(c.min_purchase) : '',
            max_discount: c.max_discount ? String(c.max_discount) : '',
            description: c.description ?? '',
          }
        : emptyForm()
    )
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(editingId ? `/api/coupons/${editingId}` : '/api/coupons', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          code: form.code.toUpperCase(),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          starts_at: form.starts_at || null,
          expires_at: form.expires_at || null,
          min_purchase: Number(form.min_purchase) || 0,
          max_discount: form.max_discount ? Number(form.max_discount) : null,
          description: form.description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Periksa kembali isian kupon', 'danger')
        return
      }
      showToast(editingId ? 'Kupon diperbarui' : 'Kupon berhasil dibuat', 'success')
      setForm(emptyForm())
      setEditingId(null)
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleActive(c: Coupon) {
    const res = await fetch(`/api/coupons/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !c.is_active }) })
    if (res.ok) load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const withStatus = coupons.map((c) => ({ ...c, status: promoStatus({ is_active: c.is_active, start: c.starts_at, end: c.expires_at, usage_limit: c.usage_limit, usage_count: c.usage_count }, today) }))
  const shown = filter === 'all' ? withStatus : withStatus.filter((c) => c.status === filter)
  const setF = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | PromoStatus)} aria-label="Filter status" className="rounded-sm border border-gray-200 px-3 py-1.5 text-sm">
          <option value="all">Semua status</option>
          {(Object.keys(PROMO_STATUS_LABEL) as PromoStatus[]).map((s) => (
            <option key={s} value={s}>
              {PROMO_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {canManage && (
          <Button size="sm" onClick={() => (showForm ? setShowForm(false) : openForm())}>
            {showForm ? 'Batal' : '+ Buat Kupon'}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <p className="text-sm font-semibold text-gray-700 sm:col-span-3">{editingId ? 'Ubah Kupon' : 'Kupon Baru'}</p>
          <div className="space-y-1">
            <Input name="coupon_code" label="Kode Kupon" required placeholder="HEMAT10" value={form.code} onChange={(e) => setF({ code: e.target.value })} />
            {!editingId && (
              <button type="button" onClick={() => setF({ code: generateCouponCode() })} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Buat kode acak
              </button>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
            <select value={form.discount_type} onChange={(e) => setF({ discount_type: e.target.value })} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <Input name="discount_value" label={form.discount_type === 'percentage' ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp)'} type="number" min="0" required value={form.discount_value} onChange={(e) => setF({ discount_value: e.target.value })} />
          <Input name="starts_at" label="Mulai Berlaku (opsional)" type="date" value={form.starts_at} onChange={(e) => setF({ starts_at: e.target.value })} />
          <Input name="expires_at" label="Kadaluarsa (opsional)" type="date" value={form.expires_at} onChange={(e) => setF({ expires_at: e.target.value })} />
          <Input name="usage_limit" label="Batas Pemakaian (opsional)" type="number" min="1" value={form.usage_limit} onChange={(e) => setF({ usage_limit: e.target.value })} />
          <Input name="min_purchase" label="Minimal Belanja (Rp, opsional)" type="number" min="0" value={form.min_purchase} onChange={(e) => setF({ min_purchase: e.target.value })} />
          <Input name="max_discount" label="Maksimal Diskon (Rp, opsional)" type="number" min="0" value={form.max_discount} onChange={(e) => setF({ max_discount: e.target.value })} />
          <Input name="description" label="Catatan (opsional)" value={form.description} onChange={(e) => setF({ description: e.target.value })} />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Syarat</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pemakaian</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Berlaku</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              {canManage && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada kupon</td>
              </tr>
            ) : (
              shown.map((c) => (
                <Fragment key={c.id}>
                  <tr onClick={() => toggleRedemptions(c.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-900">
                      {c.code}
                      {c.description && <p className="font-sans text-xs text-gray-500">{c.description}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{c.discount_type === 'percentage' ? `${c.discount_value}%` : formatCurrency(c.discount_value)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {c.min_purchase > 0 && <div>Min. belanja {formatCurrency(c.min_purchase)}</div>}
                      {c.max_discount ? <div>Maks. diskon {formatCurrency(c.max_discount)}</div> : null}
                      {!c.min_purchase && !c.max_discount && '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {c.usage_count}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ''} <span className="text-xs text-brand-500">(lihat rincian)</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {c.starts_at ? formatDate(c.starts_at) : 'Sekarang'} – {c.expires_at ? formatDate(c.expires_at) : 'Tanpa batas'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>{PROMO_STATUS_LABEL[c.status]}</span>
                    </td>
                    {canManage && (
                      <td className="space-x-3 whitespace-nowrap px-4 py-2">
                        <button onClick={(e) => { e.stopPropagation(); openForm(c) }} className="text-sm font-medium text-brand-600 hover:text-brand-700">Ubah</button>
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(c) }} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                          {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    )}
                  </tr>
                  {expandedCouponId === c.id && (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="bg-gray-50 px-4 py-3">
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
