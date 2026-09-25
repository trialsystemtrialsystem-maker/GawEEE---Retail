'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { SEGMENT_LABEL, type CustomerSegment } from '@/lib/utils/customerInsights'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Profile {
  customer: { id: string; name: string; phone: string | null; email: string | null; notes: string | null; whatsapp_opt_out: boolean; created_at: string; customer_groups: { name: string } | null; outlets: { name: string } | null }
  kpi: {
    orders: number
    spend: number
    refunded: number
    average_basket: number
    last_purchase_at: string | null
    days_since_last: number | null
    purchase_interval_days: number | null
    unpaid_total: number
    unpaid_count: number
    loyalty_points: number
    segment: CustomerSegment
  }
  favorite_products: { name: string; quantity: number; spend: number }[]
  monthly: { month: string; orders: number; spend: number }[]
  invoices: { id: string; invoice_number: string; total: number; payment_status: string; order_status: string; created_at: string; outlet_name: string }[]
  loyalty: { id: string; points_change: number; reason: string; created_at: string }[]
  phone_matched: boolean
}

const SEGMENT_CLASS: Record<CustomerSegment, string> = {
  vip: 'bg-amber-100 text-amber-800',
  loyal: 'bg-emerald-100 text-emerald-800',
  new: 'bg-blue-100 text-blue-800',
  at_risk: 'bg-orange-100 text-orange-800',
  lost: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-600',
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </Card>
  )
}

export function CustomerProfile({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', whatsapp_opt_out: false })
  const [saving, setSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}/profile`)
    const json = await res.json()
    if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Gagal memuat pelanggan')
    setData(json)
  }, [customerId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Periksa kembali isian Anda')
      showToast('Data pelanggan disimpan', 'success')
      setEditing(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (error && !data) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat…</p>
  const { customer: c, kpi } = data
  const th = 'px-3 py-2 font-semibold text-gray-600'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/sales/customers" className="text-sm text-brand-600 hover:underline">← Daftar Pelanggan</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {c.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${SEGMENT_CLASS[kpi.segment]}`}>{SEGMENT_LABEL[kpi.segment]}</span>
          </h1>
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => { setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '', whatsapp_opt_out: c.whatsapp_opt_out }); setEditing(true) }}>
              Ubah Data
            </Button>
          )}
        </div>
        <p className="text-gray-500">
          {[c.phone, c.email, c.customer_groups?.name, c.outlets?.name].filter(Boolean).join(' · ') || 'Belum ada kontak'} · terdaftar {formatDate(c.created_at)}
        </p>
        {c.notes && <p className="mt-1 text-sm text-gray-600">Catatan: {c.notes}</p>}
        {c.whatsapp_opt_out && <p className="mt-1 text-xs font-medium text-red-600">Tidak menerima pesan promosi WhatsApp</p>}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {!data.phone_matched && <Alert variant="warning">Pelanggan ini belum punya nomor telepon yang valid, sehingga riwayat transaksinya tidak bisa dicocokkan. Isi nomor teleponnya (samakan dengan yang dipakai di kasir).</Alert>}

      {editing && (
        <Card>
          <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input name="c_name" label="Nama" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <Input name="c_phone" label="Telepon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Input name="c_email" label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input name="c_notes" label="Catatan" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2"><input type="checkbox" checked={form.whatsapp_opt_out} onChange={(e) => setForm((f) => ({ ...f, whatsapp_opt_out: e.target.checked }))} /> Berhenti berlangganan pesan promosi WhatsApp (tidak diikutkan di broadcast)</label>
            <div className="flex gap-2">
              <Button type="submit" isLoading={saving}>Simpan</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Belanja" value={formatCurrency(kpi.spend)} hint={kpi.refunded > 0 ? `setelah refund ${formatCurrency(kpi.refunded)}` : `${kpi.orders} transaksi`} />
        <Kpi label="Rata-rata Keranjang" value={formatCurrency(kpi.average_basket)} />
        <Kpi label="Terakhir Belanja" value={kpi.last_purchase_at ? formatDate(kpi.last_purchase_at) : '-'} hint={kpi.days_since_last === null ? undefined : `${kpi.days_since_last} hari lalu${kpi.purchase_interval_days ? ` · biasanya tiap ${kpi.purchase_interval_days} hari` : ''}`} />
        <Kpi label="Poin Loyalti" value={String(kpi.loyalty_points)} hint={kpi.unpaid_count > 0 ? `${formatCurrency(kpi.unpaid_total)} belum lunas (${kpi.unpaid_count})` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Produk Favorit</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className={`${th} text-left`}>Produk</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Belanja</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.favorite_products.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Belum ada pembelian</td></tr>
              ) : (
                data.favorite_products.map((p) => (
                  <tr key={p.name}><td className="px-3 py-2 text-gray-900">{p.name}</td><td className="px-3 py-2 text-right text-gray-700">{p.quantity}</td><td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.spend)}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">Belanja per Bulan</h2>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className={`${th} text-left`}>Bulan</th><th className={`${th} text-right`}>Transaksi</th><th className={`${th} text-right`}>Belanja</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.monthly.length === 0 ? (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">Belum ada data</td></tr>
              ) : (
                data.monthly.map((m) => (
                  <tr key={m.month}><td className="px-3 py-2 text-gray-900">{m.month}</td><td className="px-3 py-2 text-right text-gray-700">{m.orders}</td><td className="px-3 py-2 text-right text-gray-700">{formatCurrency(m.spend)}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Riwayat Transaksi</h2>
          <ExportCsvButton filename={`pelanggan-${c.name}-transaksi`} rows={data.invoices.map((i) => ({ Invoice: i.invoice_number, Tanggal: i.created_at, Outlet: i.outlet_name, Total: i.total, Pembayaran: i.payment_status, Status: i.order_status }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-100">
              {data.invoices.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-gray-400">Belum ada transaksi</td></tr>
              ) : (
                data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2"><Link href={`/dashboard/sales/${i.id}`} className="text-brand-600 hover:underline">{i.invoice_number}</Link></td>
                    <td className="px-3 py-2 text-gray-500">{formatDateTime(i.created_at)}</td>
                    <td className="px-3 py-2 text-gray-500">{i.outlet_name}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(i.total)}</td>
                    <td className={`px-3 py-2 ${i.order_status === 'voided' ? 'text-red-600' : i.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{i.order_status === 'voided' ? 'Dibatalkan' : i.payment_status === 'paid' ? 'Lunas' : 'Belum lunas'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Riwayat Poin</h2>
        {data.loyalty.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada mutasi poin.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.loyalty.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span className="text-gray-700">{l.reason} <span className="text-xs text-gray-400">{formatDate(l.created_at)}</span></span>
                <span className={l.points_change >= 0 ? 'text-emerald-600' : 'text-red-600'}>{l.points_change > 0 ? '+' : ''}{l.points_change}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
