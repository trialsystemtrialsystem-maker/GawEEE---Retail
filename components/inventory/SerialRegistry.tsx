'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatDate } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Serial {
  id: string
  product_id: string
  product_name: string
  sku: string
  serial_number: string
  status: 'in_stock' | 'sold' | 'returned' | 'damaged'
  received_on: string
  sold_on: string | null
  notes: string | null
}

const STATUS_LABEL = { in_stock: 'Tersedia', sold: 'Terjual', returned: 'Retur', damaged: 'Rusak' }

export function SerialRegistry({ canManage }: { canManage: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [products, setProducts] = useState<{ product_id: string; name: string; sku: string }[]>([])
  const [serials, setSerials] = useState<Serial[]>([])
  const [productId, setProductId] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    if (!outletId) return
    fetch(`/api/inventory/${outletId}`)
      .then((r) => r.json())
      .then((d) => setProducts((d.inventory ?? []).map((i: { product_id: string; name: string; sku: string }) => ({ product_id: i.product_id, name: i.name, sku: i.sku }))))
      .catch(() => {})
  }, [outletId])

  const load = useCallback(async () => {
    if (!outletId) return
    const params = new URLSearchParams({ outlet_id: outletId })
    if (productId) params.set('product_id', productId)
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    const res = await fetch(`/api/inventory/serials?${params}`)
    const data = await res.json()
    if (res.ok) setSerials(data.serials ?? [])
    else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat nomor seri')
  }, [outletId, productId, status, search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  async function register(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!productId) return setError('Pilih produk dulu')
    const list = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    setBusy(true)
    try {
      const res = await fetch('/api/inventory/serials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: outletId, product_id: productId, serials: list }) })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
      showToast(`${data.created} nomor seri didaftarkan${data.duplicates.length ? `, ${data.duplicates.length} sudah ada` : ''}`, 'success')
      setText('')
      load()
    } finally {
      setBusy(false)
    }
  }

  async function setSerialStatus(id: string, next: string) {
    const res = await fetch('/api/inventory/serials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) })
    if (res.ok) load()
    else setError('Gagal mengubah status')
  }

  async function remove(id: string) {
    const res = await fetch(`/api/inventory/serials?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal menghapus')
    load()
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <div className="space-y-1">
          <label htmlFor="ser_product" className="block text-sm font-medium text-gray-700">Produk</label>
          <select id="ser_product" value={productId} onChange={(e) => setProductId(e.target.value)} className="max-w-xs rounded-sm border border-gray-200 px-3 py-2 text-sm">
            <option value="">Semua produk</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ser_status" className="block text-sm font-medium text-gray-700">Status</label>
          <select id="ser_status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-sm border border-gray-200 px-3 py-2 text-sm">
            <option value="">Semua</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <Input name="ser_search" label="Cari nomor seri" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ExportCsvButton filename="nomor-seri" rows={serials.map((s) => ({ Produk: s.product_name, SKU: s.sku, 'Nomor Seri': s.serial_number, Status: STATUS_LABEL[s.status], Diterima: s.received_on, Terjual: s.sold_on ?? '' }))} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      {canManage && (
        <Card>
          <form onSubmit={register} className="space-y-2">
            <label htmlFor="ser_text" className="block text-sm font-medium text-gray-700">Daftarkan nomor seri (satu per baris, atau pisahkan dengan koma) untuk produk yang dipilih di atas</label>
            <textarea id="ser_text" rows={4} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-sm border border-gray-200 px-3 py-2 font-mono text-sm" placeholder={'SN-0001\nSN-0002'} />
            <Button type="submit" isLoading={busy}>Daftarkan</Button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Nomor Seri</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Diterima</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {serials.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Belum ada nomor seri</td></tr>
            ) : (
              serials.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-mono text-gray-900">{s.serial_number}</td>
                  <td className="px-3 py-2 text-gray-700">{s.product_name}</td>
                  <td className="px-3 py-2 text-gray-500">{formatDate(s.received_on)}</td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <select aria-label={`Status ${s.serial_number}`} value={s.status} onChange={(e) => setSerialStatus(s.id, e.target.value)} className="rounded-sm border border-gray-200 px-2 py-1 text-sm">
                        {Object.entries(STATUS_LABEL).map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                      </select>
                    ) : (
                      STATUS_LABEL[s.status]
                    )}
                    {s.sold_on && <span className="ml-2 text-xs text-gray-400">{formatDate(s.sold_on)}</span>}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      {s.status === 'in_stock' && <button className="text-red-600 hover:underline" onClick={() => remove(s.id)}>Hapus</button>}
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
