'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Asset {
  id: string
  name: string
  category: string | null
  acquisition_date: string
  cost: number
  salvage_value: number
  useful_life_months: number
  status: string
  accumulated_depreciation: number
  book_value: number
}

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { name: '', category: '', acquisition_date: today(), cost: '', salvage_value: '0', useful_life_months: '48', pay_from: 'none' }

export function FixedAssetsManager({ canManage }: { canManage: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [assets, setAssets] = useState<Asset[]>([])
  const [form, setForm] = useState(EMPTY)
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!outletId) return
    const res = await fetch(`/api/accounting/fixed-assets?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setAssets(data.assets ?? [])
    else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat aset')
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/accounting/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          name: form.name,
          category: form.category || undefined,
          acquisition_date: form.acquisition_date,
          cost: Number(form.cost),
          salvage_value: Number(form.salvage_value || 0),
          useful_life_months: Number(form.useful_life_months),
          pay_from: form.pay_from,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast('Aset tetap ditambahkan', 'success')
      setForm(EMPTY)
      load()
    } finally {
      setBusy(false)
    }
  }

  async function depreciate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/fixed-assets/depreciate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: outletId, month }) })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menjalankan penyusutan')
        return
      }
      showToast(data.depreciated ? `${data.depreciated} aset disusutkan: ${formatCurrency(data.total)}` : 'Tidak ada penyusutan baru untuk bulan ini', 'success')
      load()
    } finally {
      setBusy(false)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const totalCost = assets.reduce((s, a) => s + a.cost, 0)
  const totalBook = assets.reduce((s, a) => s + a.book_value, 0)
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        {canManage && (
          <>
            <Input name="dep_month" label="Bulan Penyusutan" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Button onClick={depreciate} isLoading={busy}>Jalankan Penyusutan</Button>
          </>
        )}
        <ExportCsvButton
          filename="aset-tetap"
          rows={assets.map((a) => ({ Aset: a.name, Kategori: a.category ?? '', Perolehan: a.acquisition_date, Harga: a.cost, 'Umur (bln)': a.useful_life_months, 'Akumulasi Penyusutan': a.accumulated_depreciation, 'Nilai Buku': a.book_value }))}
        />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-sm text-gray-500">Total Harga Perolehan</p><p className="text-xl font-bold text-gray-900">{formatCurrency(totalCost)}</p></Card>
        <Card><p className="text-sm text-gray-500">Total Nilai Buku</p><p className="text-xl font-bold text-gray-900">{formatCurrency(totalBook)}</p></Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Aset</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Perolehan</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Umur</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Akumulasi</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Nilai Buku</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {assets.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Belum ada aset tetap</td></tr>
            ) : (
              assets.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-gray-900">{a.name}{a.category && <span className="ml-1 text-xs text-gray-400">({a.category})</span>}</td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(a.acquisition_date)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(a.cost)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{a.useful_life_months} bln</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(a.accumulated_depreciation)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(a.book_value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <Card>
          <form onSubmit={add} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
            <Input name="asset_name" label="Nama Aset" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
            <Input name="asset_category" label="Kategori" value={form.category} onChange={(e) => set({ category: e.target.value })} />
            <Input name="asset_date" label="Tanggal Perolehan" type="date" required value={form.acquisition_date} onChange={(e) => set({ acquisition_date: e.target.value })} />
            <Input name="asset_cost" label="Harga Perolehan (Rp)" type="number" min="1" required value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
            <Input name="asset_salvage" label="Nilai Sisa (Rp)" type="number" min="0" value={form.salvage_value} onChange={(e) => set({ salvage_value: e.target.value })} />
            <Input name="asset_life" label="Umur Manfaat (bulan)" type="number" min="1" required value={form.useful_life_months} onChange={(e) => set({ useful_life_months: e.target.value })} />
            <div className="space-y-1">
              <label htmlFor="asset_pay" className="block text-sm font-medium text-gray-700">Dibayar dari</label>
              <select id="asset_pay" value={form.pay_from} onChange={(e) => set({ pay_from: e.target.value })} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm">
                <option value="none">Tidak dijurnal (saldo awal)</option>
                <option value="cash">Kas</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <Button type="submit" isLoading={busy}>Tambah Aset</Button>
          </form>
        </Card>
      )}
    </div>
  )
}
