'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  payment_terms: number | null
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  tax_id: string | null
  rating: number | null
  is_preferred: boolean
  status: string
}
interface Profile {
  supplier: Supplier
  kpi: { po_count: number; total_purchased: number; outstanding: number; overdue: number; delivered: number; avg_lead_days: number | null; on_time_rate: number | null; late_count: number }
  products: { product_id: string; name: string; sku: string; quantity: number; spend: number; trend: { first: number; last: number; min: number; max: number; change_pct: number | null; purchases: number } | null }[]
  purchase_orders: { id: string; po_number: string; status: string; order_date: string; actual_delivery_date: string | null; total: number; outlet_name: string }[]
  invoices: { id: string; invoice_number: string; invoice_date: string; due_date: string; total: number; paid: number; balance: number; payment_status: string; overdue: boolean }[]
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone ?? 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </Card>
  )
}

export function SupplierProfile({ supplierId, canManage }: { supplierId: string; canManage: boolean }) {
  const [data, setData] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [saving, setSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const res = await fetch(`/api/suppliers/${supplierId}/profile`)
    const json = await res.json()
    if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Gagal memuat supplier')
    setData(json)
  }, [supplierId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  function startEdit(s: Supplier) {
    setForm({
      name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', city: s.city ?? '',
      payment_terms: s.payment_terms === null ? '' : String(s.payment_terms), bank_name: s.bank_name ?? '', bank_account_name: s.bank_account_name ?? '',
      bank_account_number: s.bank_account_number ?? '', tax_id: s.tax_id ?? '', rating: s.rating === null ? '' : String(s.rating), is_preferred: s.is_preferred, status: s.status,
    })
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const text = (k: string) => (String(form[k] ?? '').trim() === '' ? null : String(form[k]).trim())
    const num = (k: string) => (String(form[k] ?? '').trim() === '' ? null : Number(form[k]))
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.name), contact_person: text('contact_person'), phone: text('phone'), email: text('email') ?? '', address: text('address'), city: text('city'),
          payment_terms: num('payment_terms'), bank_name: text('bank_name'), bank_account_name: text('bank_account_name'), bank_account_number: text('bank_account_number'),
          tax_id: text('tax_id'), rating: num('rating'), is_preferred: !!form.is_preferred, status: form.status,
        }),
      })
      const json = await res.json()
      if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Periksa kembali isian Anda')
      showToast('Data supplier disimpan', 'success')
      setEditing(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (error && !data) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat…</p>
  const { supplier: s, kpi } = data
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  const th = 'px-3 py-2 font-semibold text-gray-600'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/suppliers" className="text-sm text-brand-600 hover:underline">← Daftar Supplier</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {s.name} {s.is_preferred && <span className="text-amber-500" title="Supplier prioritas">★</span>}
            {s.status !== 'active' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Nonaktif</span>}
          </h1>
          {canManage && !editing && <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>Ubah Data</Button>}
        </div>
        <p className="text-gray-500">
          {[s.contact_person, s.phone, s.email].filter(Boolean).join(' · ') || 'Belum ada kontak'}
          {s.payment_terms !== null && ` · tempo ${s.payment_terms} hari`}
          {s.rating !== null && ` · rating ${s.rating}/5`}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {editing && (
        <Card>
          <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input name="s_name" label="Nama" required value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} />
            <Input name="s_contact" label="Kontak" value={String(form.contact_person ?? '')} onChange={(e) => set('contact_person', e.target.value)} />
            <Input name="s_phone" label="Telepon" value={String(form.phone ?? '')} onChange={(e) => set('phone', e.target.value)} />
            <Input name="s_email" label="Email" type="email" value={String(form.email ?? '')} onChange={(e) => set('email', e.target.value)} />
            <Input name="s_city" label="Kota" value={String(form.city ?? '')} onChange={(e) => set('city', e.target.value)} />
            <Input name="s_address" label="Alamat" value={String(form.address ?? '')} onChange={(e) => set('address', e.target.value)} />
            <Input name="s_terms" label="Tempo bayar (hari)" type="number" min="0" value={String(form.payment_terms ?? '')} onChange={(e) => set('payment_terms', e.target.value)} />
            <Input name="s_tax" label="NPWP" value={String(form.tax_id ?? '')} onChange={(e) => set('tax_id', e.target.value)} />
            <Input name="s_rating" label="Rating (0–5)" type="number" min="0" max="5" step="0.1" value={String(form.rating ?? '')} onChange={(e) => set('rating', e.target.value)} />
            <Input name="s_bank" label="Bank" value={String(form.bank_name ?? '')} onChange={(e) => set('bank_name', e.target.value)} />
            <Input name="s_bank_name" label="Atas nama rekening" value={String(form.bank_account_name ?? '')} onChange={(e) => set('bank_account_name', e.target.value)} />
            <Input name="s_bank_no" label="Nomor rekening" value={String(form.bank_account_number ?? '')} onChange={(e) => set('bank_account_number', e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!form.is_preferred} onChange={(e) => set('is_preferred', e.target.checked)} /> Supplier prioritas</label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'inactive')} /> Aktif</label>
            <div className="flex items-end gap-2">
              <Button type="submit" isLoading={saving}>Simpan</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Pembelian" value={formatCurrency(kpi.total_purchased)} hint={`${kpi.po_count} PO`} />
        <Kpi label="Utang Berjalan" value={formatCurrency(kpi.outstanding)} hint={kpi.overdue > 0 ? `${formatCurrency(kpi.overdue)} lewat jatuh tempo` : 'Tidak ada yang lewat tempo'} tone={kpi.overdue > 0 ? 'text-red-600' : undefined} />
        <Kpi label="Ketepatan Kirim" value={kpi.on_time_rate === null ? '-' : `${Math.round(kpi.on_time_rate * 100)}%`} hint={kpi.on_time_rate === null ? 'Belum ada PO dengan tanggal target' : `${kpi.late_count} PO terlambat`} tone={kpi.on_time_rate !== null && kpi.on_time_rate < 0.8 ? 'text-amber-600' : undefined} />
        <Kpi label="Rata-rata Lead Time" value={kpi.avg_lead_days === null ? '-' : `${kpi.avg_lead_days} hari`} hint={`${kpi.delivered} PO sudah diterima`} />
      </div>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Barang yang Dibeli & Riwayat Harga</h2>
          <ExportCsvButton filename={`supplier-${s.name}-barang`} rows={data.products.map((p) => ({ Produk: p.name, SKU: p.sku, Qty: p.quantity, Belanja: p.spend, 'Harga Pertama': p.trend?.first ?? '', 'Harga Terakhir': p.trend?.last ?? '', Terendah: p.trend?.min ?? '', Tertinggi: p.trend?.max ?? '' }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Produk</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Belanja</th>
                <th className={`${th} text-right`}>Harga Terakhir</th>
                <th className={`${th} text-right`}>Rentang</th>
                <th className={`${th} text-right`}>Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.products.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Belum ada pembelian dari supplier ini</td></tr>
              ) : (
                data.products.map((p) => {
                  const change = p.trend?.change_pct ?? null
                  return (
                    <tr key={p.product_id}>
                      <td className="px-3 py-2 text-gray-900">{p.name}<span className="block text-xs text-gray-400">{p.sku}</span></td>
                      <td className="px-3 py-2 text-right text-gray-700">{p.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.spend)}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{p.trend ? formatCurrency(p.trend.last) : '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.trend ? `${formatCurrency(p.trend.min)} – ${formatCurrency(p.trend.max)}` : '-'}</td>
                      <td className={`px-3 py-2 text-right ${change === null ? 'text-gray-400' : change > 0.05 ? 'font-semibold text-red-600' : change < 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                        {change === null || (p.trend?.purchases ?? 0) < 2 ? '-' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Purchase Order Terbaru</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-100">
              {data.purchase_orders.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-gray-400">Belum ada PO</td></tr>
              ) : (
                data.purchase_orders.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-gray-900">{p.po_number}<span className="block text-xs text-gray-400">{p.outlet_name} · {formatDate(p.order_date)}</span></td>
                    <td className="px-3 py-2 text-gray-500">{p.status}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(p.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Tagihan</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-100">
              {data.invoices.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-gray-400">Belum ada tagihan</td></tr>
              ) : (
                data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 text-gray-900">{i.invoice_number}<span className="block text-xs text-gray-400">Jatuh tempo {formatDate(i.due_date)}</span></td>
                    <td className={`px-3 py-2 ${i.overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>{i.balance > 0 ? (i.overdue ? 'Lewat tempo' : 'Belum lunas') : 'Lunas'}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(i.balance > 0 ? i.balance : i.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
