'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'
import { promoStatus, PROMO_STATUS_LABEL, type PromoStatus } from '@/lib/utils/promoRules'

interface Promotion {
  id: string
  name: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  start_date: string
  end_date: string
  is_active: boolean
  min_purchase: number
  max_discount: number | null
  usage_limit: number | null
  description: string | null
  uses: number
  total_discount: number
}

interface Application {
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

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = () => ({
  name: '',
  discount_type: 'percentage',
  discount_value: '',
  start_date: today(),
  end_date: today(),
  min_purchase: '',
  max_discount: '',
  usage_limit: '',
  description: '',
})
type Form = ReturnType<typeof emptyForm>

export function PromotionManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [filter, setFilter] = useState<'all' | PromoStatus>('all')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoadingApplications, setIsLoadingApplications] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  async function toggleApplications(promotionId: string) {
    if (expandedId === promotionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(promotionId)
    setIsLoadingApplications(true)
    try {
      const res = await fetch(`/api/promotion-applications?promotion_id=${promotionId}`)
      const data = await res.json()
      setApplications(res.ok ? (data.applications ?? []) : [])
    } finally {
      setIsLoadingApplications(false)
    }
  }

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

  function openForm(p?: Promotion, duplicate = false) {
    setEditingId(p && !duplicate ? p.id : null)
    setForm(
      p
        ? {
            name: duplicate ? `${p.name} (salinan)` : p.name,
            discount_type: p.discount_type,
            discount_value: String(p.discount_value),
            start_date: duplicate ? today() : p.start_date,
            end_date: duplicate ? today() : p.end_date,
            min_purchase: p.min_purchase ? String(p.min_purchase) : '',
            max_discount: p.max_discount ? String(p.max_discount) : '',
            usage_limit: p.usage_limit ? String(p.usage_limit) : '',
            description: p.description ?? '',
          }
        : emptyForm()
    )
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(editingId ? `/api/promotions/${editingId}` : '/api/promotions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          name: form.name,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          start_date: form.start_date,
          end_date: form.end_date,
          min_purchase: Number(form.min_purchase) || 0,
          max_discount: form.max_discount ? Number(form.max_discount) : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          description: form.description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Periksa kembali isian promosi', 'danger')
        return
      }
      showToast(editingId ? 'Promosi diperbarui' : 'Promosi berhasil dibuat', 'success')
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
      load()
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

  const withStatus = promotions.map((p) => ({ ...p, status: promoStatus({ is_active: p.is_active, start: p.start_date, end: p.end_date, usage_limit: p.usage_limit, usage_count: p.uses }, today()) }))
  const shown = filter === 'all' ? withStatus : withStatus.filter((p) => p.status === filter)
  const activeCount = withStatus.filter((p) => p.status === 'active').length
  const totalUses = promotions.reduce((s, p) => s + p.uses, 0)
  const totalDiscount = promotions.reduce((s, p) => s + p.total_discount, 0)
  const setF = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Promosi berjalan', String(activeCount)],
          ['Total pemakaian', String(totalUses)],
          ['Total diskon diberikan', formatCurrency(totalDiscount)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

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
            {showForm ? 'Batal' : '+ Buat Promosi'}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <p className="text-sm font-semibold text-gray-700 sm:col-span-3">{editingId ? 'Ubah Promosi' : 'Promosi Baru'}</p>
          <div className="sm:col-span-2">
            <Input name="promotion_name" label="Nama Promosi" required placeholder="Diskon Akhir Pekan" value={form.name} onChange={(e) => setF({ name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe Diskon</label>
            <select value={form.discount_type} onChange={(e) => setF({ discount_type: e.target.value })} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="percentage">Persentase (%)</option>
              <option value="fixed">Nominal (Rp)</option>
            </select>
          </div>
          <Input name="discount_value" label={form.discount_type === 'percentage' ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp)'} type="number" min="0" required value={form.discount_value} onChange={(e) => setF({ discount_value: e.target.value })} />
          <Input name="start_date" label="Mulai" type="date" required value={form.start_date} onChange={(e) => setF({ start_date: e.target.value })} />
          <Input name="end_date" label="Selesai" type="date" required value={form.end_date} onChange={(e) => setF({ end_date: e.target.value })} />
          <Input name="min_purchase" label="Minimal Belanja (Rp, opsional)" type="number" min="0" value={form.min_purchase} onChange={(e) => setF({ min_purchase: e.target.value })} />
          <Input name="max_discount" label="Maksimal Diskon (Rp, opsional)" type="number" min="0" value={form.max_discount} onChange={(e) => setF({ max_discount: e.target.value })} />
          <Input name="usage_limit" label="Batas Pemakaian (opsional)" type="number" min="1" value={form.usage_limit} onChange={(e) => setF({ usage_limit: e.target.value })} />
          <div className="sm:col-span-3">
            <Input name="description" label="Catatan (opsional)" value={form.description} onChange={(e) => setF({ description: e.target.value })} />
          </div>
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Syarat</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Periode</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Dipakai</th>
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
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada promosi</td>
              </tr>
            ) : (
              shown.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => toggleApplications(p.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">
                      {p.name} <span className="text-xs text-brand-500">(lihat rincian)</span>
                      {p.description && <p className="text-xs text-gray-500">{p.description}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{p.discount_type === 'percentage' ? `${p.discount_value}%` : formatCurrency(p.discount_value)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {p.min_purchase > 0 && <div>Min. belanja {formatCurrency(p.min_purchase)}</div>}
                      {p.max_discount ? <div>Maks. diskon {formatCurrency(p.max_discount)}</div> : null}
                      {p.usage_limit ? <div>Batas {p.usage_limit}x</div> : null}
                      {!p.min_purchase && !p.max_discount && !p.usage_limit && '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatDate(p.start_date)} - {formatDate(p.end_date)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {p.uses}x
                      <div className="text-xs text-gray-500">{formatCurrency(p.total_discount)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{PROMO_STATUS_LABEL[p.status]}</span>
                    </td>
                    {canManage && (
                      <td className="space-x-3 whitespace-nowrap px-4 py-2">
                        <button onClick={(e) => { e.stopPropagation(); openForm(p) }} className="text-sm font-medium text-brand-600 hover:text-brand-700">Ubah</button>
                        <button onClick={(e) => { e.stopPropagation(); openForm(p, true) }} className="text-sm font-medium text-brand-600 hover:text-brand-700">Duplikat</button>
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(p) }} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                          {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    )}
                  </tr>
                  {expandedId === p.id && (
                    <tr>
                      <td colSpan={canManage ? 7 : 6} className="bg-gray-50 px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-gray-500">Rincian Pemakaian — {p.name}</p>
                        {isLoadingApplications ? (
                          <p className="text-xs text-gray-400">Memuat…</p>
                        ) : applications.length === 0 ? (
                          <p className="text-xs text-gray-400">Belum ada transaksi yang memakai promosi ini.</p>
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
                              {applications.map((a) => (
                                <tr key={a.id}>
                                  <td className="py-1 pr-4 font-mono text-gray-800">{a.invoices?.invoice_number ?? '-'}</td>
                                  <td className="py-1 pr-4 text-gray-600">{formatDateTime(a.created_at)}</td>
                                  <td className="py-1 pr-4 text-right text-gray-700">{formatCurrency(a.discount_amount)}</td>
                                  <td className="py-1 pr-4 text-right text-gray-700">{a.invoices ? formatCurrency(a.invoices.total) : '-'}</td>
                                  <td className="py-1 pr-4 text-gray-600">{a.invoices?.order_status === 'voided' ? 'Dibatalkan' : 'Selesai'}</td>
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
