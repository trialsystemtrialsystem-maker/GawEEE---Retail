'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Item {
  product_id: string
  sku: string
  name: string
  category_id: string | null
  category_name: string | null
  supplier_name: string | null
  unit_type: string
  unit_price: number
  purchase_price: number
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  reorder_level: number
  cost_value: number
  retail_value: number
  margin_pct: number | null
  status: string
  sold_30d: number
  avg_daily_sales: number
  days_of_cover: number | null
  health: 'dead' | 'slow' | 'active' | 'empty'
  suggested_reorder: number
  abc_class: 'A' | 'B' | 'C'
}
interface Summary {
  sku_count: number
  low_stock: number
  out_of_stock: number
  dead_stock: number
  needs_reorder: number
  dead_stock_value: number
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  normal: { label: 'OK', className: 'text-emerald-600' },
  low_stock: { label: 'Stok Rendah', className: 'text-amber-600' },
  out_of_stock: { label: 'Habis', className: 'text-red-600' },
  overstock: { label: 'Overstock', className: 'text-brand-600' },
}
const HEALTH_LABEL: Record<string, string> = { dead: 'Tidak bergerak', slow: 'Lambat', active: 'Aktif', empty: 'Kosong' }
type SortKey = 'name' | 'quantity_on_hand' | 'cost_value' | 'days_of_cover' | 'sold_30d'

export function StockOverview({ canAdjust }: { canAdjust: boolean }) {
  const searchParams = useSearchParams()
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [totals, setTotals] = useState({ cost: 0, retail: 0 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [category, setCategory] = useState('')
  const [health, setHealth] = useState('')
  const [abc, setAbc] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<Item | null>(null)
  const [adj, setAdj] = useState({ count: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [levelFor, setLevelFor] = useState<Item | null>(null)
  const [level, setLevel] = useState('')
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!outletId) return
      if (!opts?.silent) setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/inventory/${outletId}?analytics=1`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Gagal memuat inventori')
          return
        }
        setItems(data.inventory ?? [])
        setSummary(data.summary ?? null)
        setTotals({ cost: data.total_value_on_hand ?? 0, retail: data.total_retail_value ?? 0 })
      } catch {
        setError('Terjadi kesalahan jaringan')
      } finally {
        if (!opts?.silent) setIsLoading(false)
      }
    },
    [outletId]
  )

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  // Live updates when this outlet's stock changes elsewhere (a sale, an
  // adjustment, a PO receipt); bursts coalesce into one silent reload. The
  // realtime socket needs the user's token set explicitly (RLS-gated).
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return
      supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel(`inventory-outlet-${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `outlet_id=eq.${outletId}` }, () => {
          if (debounce.current) clearTimeout(debounce.current)
          debounce.current = setTimeout(() => load({ silent: true }), 400)
        })
        .subscribe()
    })
    return () => {
      cancelled = true
      if (debounce.current) clearTimeout(debounce.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [outletId, load])

  const categories = useMemo(() => Array.from(new Map(items.filter((i) => i.category_id).map((i) => [i.category_id as string, i.category_name ?? ''])).entries()), [items])

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = items.filter(
      (i) =>
        (!needle || i.name.toLowerCase().includes(needle) || i.sku.toLowerCase().includes(needle)) &&
        (!status || i.status === status) &&
        (!category || i.category_id === category) &&
        (!health || i.health === health) &&
        (!abc || i.abc_class === abc)
    )
    const val = (i: Item) => {
      const v = i[sort.key]
      return v === null ? Number.POSITIVE_INFINITY : v
    }
    return list.sort((a, b) => (sort.key === 'name' ? a.name.localeCompare(b.name) * sort.dir : ((val(a) as number) - (val(b) as number)) * sort.dir))
  }, [items, search, status, category, health, abc, sort])

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault()
    if (!adjusting) return
    const counted = Number(adj.count)
    const delta = counted - adjusting.quantity_on_hand
    if (!Number.isInteger(counted) || counted < 0) return setError('Jumlah stok sebenarnya harus bilangan bulat ≥ 0')
    if (delta === 0) return setError('Jumlah sama dengan stok sistem — tidak ada yang disesuaikan')
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, product_id: adjusting.product_id, quantity_change: delta, reason: adj.reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast(`Stok ${adjusting.name} disesuaikan (${delta > 0 ? '+' : ''}${delta})`, 'success')
      setAdjusting(null)
      setAdj({ count: '', reason: '' })
      load({ silent: true })
    } finally {
      setSaving(false)
    }
  }

  async function saveLevel(e: React.FormEvent) {
    e.preventDefault()
    if (!levelFor) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/reorder-level', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, product_id: levelFor.product_id, reorder_level: Number(level) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast(`Titik pesan ${levelFor.name} diubah menjadi ${data.reorder_level}`, 'success')
      setLevelFor(null)
      load({ silent: true })
    } finally {
      setSaving(false)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const sortBtn = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} className={`font-semibold text-gray-600 hover:text-gray-900 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {label}
      {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </button>
  )
  const th = 'px-3 py-2'
  const select = 'rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Cari nama atau SKU…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari produk" />
        </div>
        <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">Semua Status</option>
          <option value="low_stock">Stok Rendah</option>
          <option value="out_of_stock">Habis</option>
          <option value="normal">Normal</option>
        </select>
        <select aria-label="Filter kategori" value={category} onChange={(e) => setCategory(e.target.value)} className={select}>
          <option value="">Semua Kategori</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select aria-label="Filter pergerakan" value={health} onChange={(e) => setHealth(e.target.value)} className={select}>
          <option value="">Semua Pergerakan</option>
          {Object.entries(HEALTH_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select aria-label="Filter kelas ABC" value={abc} onChange={(e) => setAbc(e.target.value)} className={select}>
          <option value="">Semua Kelas ABC</option>
          <option value="A">Kelas A</option>
          <option value="B">Kelas B</option>
          <option value="C">Kelas C</option>
        </select>
        <ExportCsvButton
          filename="stok-barang"
          rows={shown.map((i) => ({
            SKU: i.sku, Produk: i.name, Kategori: i.category_name ?? '', Supplier: i.supplier_name ?? '', Satuan: i.unit_type,
            Stok: i.quantity_on_hand, Tertahan: i.quantity_reserved, Tersedia: i.quantity_available, 'Titik Pesan': i.reorder_level,
            'Harga Beli': i.purchase_price, 'Harga Jual': i.unit_price, 'Nilai Stok': i.cost_value, 'Nilai Jual': i.retail_value,
            'Margin %': i.margin_pct ?? '', 'Terjual 30h': i.sold_30d, 'Sisa Hari': i.days_of_cover ?? '', Pergerakan: HEALTH_LABEL[i.health], ABC: i.abc_class, 'Saran Pesan': i.suggested_reorder,
          }))}
        />
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Card><p className="text-xs text-gray-500">Jumlah SKU</p><p className="text-xl font-bold text-gray-900">{summary.sku_count}</p></Card>
          <Card><p className="text-xs text-gray-500">Nilai Stok (HPP)</p><p className="text-lg font-bold text-gray-900">{formatCurrency(totals.cost)}</p><p className="text-xs text-gray-400">Nilai jual {formatCurrency(totals.retail)}</p></Card>
          <Card><button className="text-left" onClick={() => setStatus('low_stock')}><p className="text-xs text-gray-500">Stok Rendah</p><p className="text-xl font-bold text-amber-600">{summary.low_stock}</p></button></Card>
          <Card><button className="text-left" onClick={() => setStatus('out_of_stock')}><p className="text-xs text-gray-500">Habis</p><p className="text-xl font-bold text-red-600">{summary.out_of_stock}</p></button></Card>
          <Card><button className="text-left" onClick={() => setHealth('dead')}><p className="text-xs text-gray-500">Tidak Bergerak (60h)</p><p className="text-xl font-bold text-gray-900">{summary.dead_stock}</p><p className="text-xs text-gray-400">{formatCurrency(summary.dead_stock_value)} tertahan</p></button></Card>
          <Card><Link href="/dashboard/inventory/reorder" className="block"><p className="text-xs text-gray-500">Perlu Dipesan</p><p className="text-xl font-bold text-brand-600">{summary.needs_reorder}</p><p className="text-xs text-brand-600">Lihat rekomendasi →</p></Link></Card>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {adjusting && (
        <Card>
          <form onSubmit={saveAdjustment} className="flex flex-wrap items-end gap-3">
            <div>
              <p className="font-medium text-gray-900">Sesuaikan stok: {adjusting.name}</p>
              <p className="text-sm text-gray-500">Stok sistem saat ini {adjusting.quantity_on_hand} {adjusting.unit_type}</p>
            </div>
            <Input name="adj_count" label="Stok sebenarnya" type="number" min="0" required value={adj.count} onChange={(e) => setAdj((a) => ({ ...a, count: e.target.value }))} />
            <Input name="adj_reason" label="Alasan" required minLength={3} value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} />
            <Button type="submit" isLoading={saving}>Simpan</Button>
            <Button type="button" variant="secondary" onClick={() => setAdjusting(null)}>Batal</Button>
          </form>
        </Card>
      )}

      {levelFor && (
        <Card>
          <form onSubmit={saveLevel} className="flex flex-wrap items-end gap-3">
            <div>
              <p className="font-medium text-gray-900">Titik pesan: {levelFor.name}</p>
              <p className="text-sm text-gray-500">Stok di bawah angka ini ditandai &quot;Stok Rendah&quot; dan masuk rekomendasi pemesanan (khusus outlet ini).</p>
            </div>
            <Input name="level" label="Titik pesan" type="number" min="0" required value={level} onChange={(e) => setLevel(e.target.value)} />
            <Button type="submit" isLoading={saving}>Simpan</Button>
            <Button type="button" variant="secondary" onClick={() => setLevelFor(null)}>Batal</Button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>{sortBtn('name', 'Produk', 'left')}</th>
              <th className={`${th} text-right`}>{sortBtn('quantity_on_hand', 'Stok')}</th>
              <th className={`${th} text-right font-semibold text-gray-600`}>Titik Pesan</th>
              <th className={`${th} text-right`}>{sortBtn('sold_30d', 'Terjual 30h')}</th>
              <th className={`${th} text-right`}>{sortBtn('days_of_cover', 'Sisa Hari')}</th>
              <th className={`${th} text-right`}>{sortBtn('cost_value', 'Nilai Stok')}</th>
              <th className={`${th} text-right font-semibold text-gray-600`}>Margin</th>
              <th className={`${th} text-left font-semibold text-gray-600`}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Tidak ada produk ditemukan</td></tr>
            ) : (
              shown.map((row) => {
                const st = STATUS_LABEL[row.status] ?? { label: row.status, className: 'text-gray-500' }
                return (
                  <tr key={row.product_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm">
                          {getProductIcon({ name: row.name, categoryName: row.category_name })}
                        </span>
                        <span>
                          {row.name}
                          <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] font-semibold text-gray-500" title="Kelas ABC berdasarkan nilai stok">{row.abc_class}</span>
                          <span className="block text-xs text-gray-400">{row.sku}{row.category_name ? ` · ${row.category_name}` : ''}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {row.quantity_on_hand} <span className="text-xs text-gray-400">{row.unit_type}</span>
                      {row.quantity_reserved > 0 && <span className="block text-xs text-gray-400">{row.quantity_reserved} tertahan</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {canAdjust ? (
                        <button className="hover:text-brand-600 hover:underline" title="Ubah titik pesan" onClick={() => { setLevelFor(row); setLevel(String(row.reorder_level)) }}>
                          {row.reorder_level}
                        </button>
                      ) : (
                        row.reorder_level
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.sold_30d}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.days_of_cover === null ? '-' : `${row.days_of_cover} hr`}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(row.cost_value)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{row.margin_pct === null ? '-' : `${row.margin_pct}%`}</td>
                    <td className={`px-3 py-2 font-medium ${st.className}`}>
                      {st.label}
                      {row.health === 'dead' && <span className="block text-xs font-normal text-gray-400">Tidak bergerak</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Link href={`/dashboard/inventory/stock-card?product_id=${row.product_id}`} className="text-brand-600 hover:underline">Kartu</Link>
                      {canAdjust && (
                        <button className="ml-3 text-brand-600 hover:underline" onClick={() => { setAdjusting(row); setAdj({ count: String(row.quantity_on_hand), reason: '' }) }}>
                          Sesuaikan
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
