'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface OrderItem {
  product_id?: string
  name: string
  quantity: number
  price: number
}
interface OnlineOrder {
  id: string
  order_number: string
  channel: string
  customer_name: string
  customer_phone: string | null
  items: OrderItem[]
  total_amount: number
  status: string
  created_at: string
  invoice_id: string | null
  payment_method: string
  payment_status: string
  shipping_fee: number
  external_ref: string | null
  delivery_address: string | null
  courier: string | null
  tracking_number: string | null
  cancel_reason: string | null
  notes: string | null
}
interface ProductOption {
  product_id: string
  name: string
  sku: string
  unit_price: number
  quantity_available: number
}

const STATUS_TABS = [
  { key: 'incoming', label: 'Pesanan Masuk' },
  { key: 'on_process', label: 'Diproses' },
  { key: 'on_delivery', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
] as const

const NEXT_STATUS: Record<string, { key: string; label: string } | null> = {
  incoming: { key: 'on_process', label: 'Proses Pesanan' },
  on_process: { key: 'on_delivery', label: 'Kirim Pesanan' },
  on_delivery: { key: 'completed', label: 'Tandai Selesai' },
  completed: null,
  cancelled: null,
}

const CHANNEL_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', marketplace: 'Marketplace', other: 'Lainnya' }
const PAY_LABEL: Record<string, string> = { bank_transfer: 'Transfer', e_wallet: 'E-Wallet', cash: 'Tunai', cod: 'COD (bayar di tempat)' }

type ItemForm = { product_id: string; name: string; quantity: string; price: string }
const EMPTY_ITEM: ItemForm = { product_id: '', name: '', quantity: '1', price: '' }
const EMPTY_FORM = { channel: 'whatsapp', customer_name: '', customer_phone: '', payment_method: 'bank_transfer', payment_status: 'unpaid', shipping_fee: '', external_ref: '', delivery_address: '', courier: '', notes: '' }

function waLink(o: OnlineOrder) {
  const digits = (o.customer_phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const number = digits.startsWith('0') ? `62${digits.slice(1)}` : digits
  const label: Record<string, string> = { incoming: 'kami terima', on_process: 'sedang kami proses', on_delivery: `sudah dikirim${o.courier ? ` via ${o.courier}` : ''}${o.tracking_number ? ` (resi ${o.tracking_number})` : ''}`, completed: 'sudah selesai', cancelled: 'dibatalkan' }
  return `https://wa.me/${number}?text=${encodeURIComponent(`Halo ${o.customer_name}, pesanan ${o.order_number} ${label[o.status] ?? ''}. Terima kasih!`)}`
}

export function OnlineOrdersManager({ outletId }: { outletId: string }) {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]['key']>('incoming')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [items, setItems] = useState<ItemForm[]>([EMPTY_ITEM])
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [oRes, pRes] = await Promise.all([fetch(`/api/online-orders?outlet_id=${outletId}`), fetch(`/api/inventory/${outletId}`)])
    const [oData, pData] = await Promise.all([oRes.json(), pRes.json()])
    if (oRes.ok) setOrders(oData.orders ?? [])
    if (pRes.ok) setProducts((pData.inventory ?? []).map((i: ProductOption) => ({ product_id: i.product_id, name: i.name, sku: i.sku, unit_price: i.unit_price, quantity_available: i.quantity_available })))
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = orders.filter((o) => o.status === t.key).length
    return acc
  }, {})

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return orders.filter((o) => o.status === tab && (!needle || o.order_number.toLowerCase().includes(needle) || o.customer_name.toLowerCase().includes(needle) || (o.customer_phone ?? '').includes(needle) || (o.external_ref ?? '').toLowerCase().includes(needle)))
  }, [orders, tab, search])

  const byChannel = useMemo(() => {
    const m = new Map<string, { orders: number; total: number }>()
    for (const o of orders.filter((x) => x.status !== 'cancelled')) {
      const e = m.get(o.channel) ?? { orders: 0, total: 0 }
      e.orders += 1
      e.total += o.total_amount
      m.set(o.channel, e)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total)
  }, [orders])

  function setItem(i: number, patch: Partial<ItemForm>) {
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.product_id === productId)
    setItem(i, p ? { product_id: p.product_id, name: p.name, price: String(p.unit_price) } : { product_id: '' })
  }

  const formTotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0) + (Number(form.shipping_fee) || 0)
  const unlinked = items.filter((i) => i.name && !i.product_id).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/online-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          channel: form.channel,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || undefined,
          payment_method: form.payment_method,
          payment_status: form.payment_method === 'cod' ? 'unpaid' : form.payment_status,
          shipping_fee: Number(form.shipping_fee) || undefined,
          external_ref: form.external_ref || undefined,
          delivery_address: form.delivery_address || undefined,
          courier: form.courier || undefined,
          notes: form.notes || undefined,
          items: items.filter((it) => it.name).map((it) => ({ ...(it.product_id ? { product_id: it.product_id } : {}), name: it.name, quantity: Number(it.quantity), price: Number(it.price) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan pesanan')
        return
      }
      showToast('Pesanan dicatat', 'success')
      setForm(EMPTY_FORM)
      setItems([EMPTY_ITEM])
      setShowForm(false)
      setTab('incoming')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function advance(o: OnlineOrder, target: string) {
    setError(null)
    setNotice(null)
    const body: Record<string, unknown> = { status: target }
    if (target === 'cancelled') {
      const reason = window.prompt('Alasan pembatalan pesanan:')
      if (reason === null) return
      body.reason = reason || undefined
    }
    if (target === 'on_delivery') {
      const courier = window.prompt('Kurir (mis. JNE, GoSend) — kosongkan jika tidak ada:', o.courier ?? '')
      if (courier === null) return
      const resi = window.prompt('Nomor resi — kosongkan jika tidak ada:', o.tracking_number ?? '')
      if (resi === null) return
      if (courier) body.courier = courier
      if (resi) body.tracking_number = resi
    }
    if (target === 'completed' && o.payment_status !== 'paid') {
      body.paid = window.confirm(o.payment_method === 'cod' ? 'Pembayaran COD sudah diterima kurir/toko?' : 'Pesanan ini belum tercatat lunas. Tandai sudah dibayar?')
    }
    const res = await fetch(`/api/online-orders/${o.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal mengubah status')
    if (data.note) setNotice(data.note)
    else if (target === 'on_process' && data.invoice_id) showToast('Invoice dibuat, stok dikurangi', 'success')
    load()
  }

  const select = 'w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const activeRevenue = orders.filter((o) => ['on_process', 'on_delivery', 'completed'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs text-gray-500">Perlu Diproses</p><p className={`text-xl font-bold ${counts.incoming ? 'text-amber-600' : 'text-gray-900'}`}>{counts.incoming ?? 0}</p></Card>
        <Card><p className="text-xs text-gray-500">Sedang Berjalan</p><p className="text-xl font-bold text-gray-900">{(counts.on_process ?? 0) + (counts.on_delivery ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-500">Nilai Pesanan Berjalan/Selesai</p><p className="text-xl font-bold text-gray-900">{formatCurrency(activeRevenue)}</p></Card>
        <Card>
          <p className="text-xs text-gray-500">Per Kanal</p>
          <p className="text-sm text-gray-700">{byChannel.length === 0 ? '-' : byChannel.slice(0, 3).map(([c, v]) => `${CHANNEL_LABEL[c] ?? c} ${v.orders}`).join(' · ')}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`rounded px-3 py-1 text-sm font-medium ${tab === t.key ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label} <span className="opacity-70">({counts[t.key] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Cari no. pesanan, nama, resi…" aria-label="Cari pesanan" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ExportCsvButton filename="pesanan-online" rows={orders.map((o) => ({ No: o.order_number, Kanal: CHANNEL_LABEL[o.channel] ?? o.channel, Referensi: o.external_ref ?? '', Pelanggan: o.customer_name, Telepon: o.customer_phone ?? '', Total: o.total_amount, Ongkir: o.shipping_fee, Pembayaran: PAY_LABEL[o.payment_method] ?? o.payment_method, Lunas: o.payment_status === 'paid' ? 'Ya' : 'Belum', Status: o.status, Kurir: o.courier ?? '', Resi: o.tracking_number ?? '', Waktu: o.created_at }))} />
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Tutup' : '+ Catat Pesanan'}</Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="warning">{notice}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="oo_channel" className="block text-sm font-medium text-gray-700">Kanal</label>
              <select id="oo_channel" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className={select}>
                {Object.entries(CHANNEL_LABEL).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </div>
            <Input name="oo_customer_name" label="Nama Pelanggan" required value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
            <Input name="oo_customer_phone" label="No. Telepon / WA" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} />
            <Input name="oo_external_ref" label="No. Pesanan Marketplace (opsional)" value={form.external_ref} onChange={(e) => setForm((f) => ({ ...f, external_ref: e.target.value }))} />
            <div className="space-y-1">
              <label htmlFor="oo_pay" className="block text-sm font-medium text-gray-700">Pembayaran</label>
              <select id="oo_pay" value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} className={select}>
                {Object.entries(PAY_LABEL).map(([k, l]) => (<option key={k} value={k}>{l}</option>))}
              </select>
            </div>
            {form.payment_method !== 'cod' && (
              <label className="flex items-end gap-2 pb-2 text-sm text-gray-700"><input type="checkbox" checked={form.payment_status === 'paid'} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.checked ? 'paid' : 'unpaid' }))} /> Sudah dibayar</label>
            )}
            <Input name="oo_address" label="Alamat Pengiriman" value={form.delivery_address} onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))} />
            <Input name="oo_courier" label="Kurir (opsional)" value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} />
            <Input name="oo_shipping" label="Ongkos Kirim (Rp)" type="number" min="0" value={form.shipping_fee} onChange={(e) => setForm((f) => ({ ...f, shipping_fee: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Item</p>
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select aria-label={`Produk ${i + 1}`} value={it.product_id} onChange={(e) => pickProduct(i, e.target.value)} className="min-w-[14rem] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Produk katalog… (atau ketik nama bebas →)</option>
                  {products.map((p) => (<option key={p.product_id} value={p.product_id}>{p.name} · stok {p.quantity_available}</option>))}
                </select>
                <Input name={`oo_item_name_${i}`} placeholder="Nama item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value, ...(it.product_id ? { product_id: '' } : {}) })} />
                <Input name={`oo_item_qty_${i}`} type="number" min="1" className="w-20" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                <Input name={`oo_item_price_${i}`} type="number" min="0" placeholder="Harga" className="w-32" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l))}>Hapus</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setItems((l) => [...l, EMPTY_ITEM])}>+ Item</Button>
            {unlinked > 0 && <p className="text-xs text-amber-600">{unlinked} item tidak dipilih dari katalog — pesanan ini tidak akan mengurangi stok atau masuk laporan penjualan.</p>}
          </div>

          <Input name="oo_notes" label="Catatan" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="flex items-center gap-3">
            <Button type="submit" isLoading={isSubmitting}>Simpan Pesanan</Button>
            <span className="text-sm text-gray-500">Total: <strong className="text-gray-900">{formatCurrency(formTotal)}</strong></span>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-gray-200 p-6 text-center text-gray-400">Tidak ada pesanan di tahap ini</p>
      ) : (
        <div className="space-y-2">
          {visible.map((o) => {
            const next = NEXT_STATUS[o.status]
            const wa = waLink(o)
            const linked = o.items.every((i) => i.product_id)
            return (
              <Card key={o.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {o.customer_name} <span className="font-mono text-xs text-gray-400">{o.order_number}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {CHANNEL_LABEL[o.channel] ?? o.channel}{o.external_ref ? ` · ${o.external_ref}` : ''} · {formatDateTime(o.created_at)} · {PAY_LABEL[o.payment_method] ?? o.payment_method}{' '}
                      <span className={o.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}>({o.payment_status === 'paid' ? 'lunas' : 'belum lunas'})</span>
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(o.total_amount)}</p>
                </div>
                <ul className="text-sm text-gray-700">
                  {o.items.map((it, i) => (
                    <li key={i}>{it.quantity}× {it.name} <span className="text-gray-400">@ {formatCurrency(it.price)}</span>{!it.product_id && <span className="ml-1 text-xs text-amber-600">(tanpa produk katalog)</span>}</li>
                  ))}
                  {o.shipping_fee > 0 && <li className="text-gray-500">Ongkir {formatCurrency(o.shipping_fee)}</li>}
                </ul>
                {(o.delivery_address || o.courier || o.tracking_number) && (
                  <p className="text-xs text-gray-500">{[o.delivery_address, o.courier && `Kurir ${o.courier}`, o.tracking_number && `Resi ${o.tracking_number}`].filter(Boolean).join(' · ')}</p>
                )}
                {o.cancel_reason && <p className="text-xs text-red-500">Dibatalkan: {o.cancel_reason}</p>}
                <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-2">
                  {next && <button onClick={() => advance(o, next.key)} className="text-sm font-medium text-brand-600 hover:text-brand-700">{next.label}</button>}
                  {!['completed', 'cancelled'].includes(o.status) && <button onClick={() => advance(o, 'cancelled')} className="text-sm font-medium text-red-500 hover:text-red-700">Batalkan</button>}
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline">Kabari via WhatsApp</a>}
                  {o.invoice_id && <Link href={`/dashboard/sales/${o.invoice_id}`} className="text-sm text-gray-600 hover:underline">Lihat invoice</Link>}
                  {!o.invoice_id && o.status !== 'cancelled' && !linked && <span className="text-xs text-amber-600">Tidak masuk laporan penjualan</span>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
