'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'
import { marginOf } from '@/lib/utils/pricing'
import { parseCsvTable, parseNumber } from '@/lib/utils/csvTable'
import { useNotificationStore } from '@/store/notificationStore'
import { ProductUnitsEditor } from '@/components/products/ProductUnitsEditor'

interface Product {
  id: string
  sku: string
  name: string
  barcode: string | null
  brand: string | null
  description: string | null
  category_id: string | null
  supplier_id: string | null
  purchase_price: number
  selling_price: number
  unit_type: string
  reorder_level: number
  reorder_quantity: number
  is_active: boolean
  product_type: 'goods' | 'service'
}
interface Summary { total: number; active: number; inactive: number; no_category: number; no_supplier: number; low_margin: number; below_cost: number }
interface Option { id: string; name: string }
interface PriceChange { id: string; old_purchase_price: number | null; new_purchase_price: number | null; old_selling_price: number | null; new_selling_price: number | null; changed_at: string; changed_by_name: string | null }
interface BulkChange { id: string; sku: string; name: string; old: { selling_price: number; purchase_price: number }; new: { selling_price: number; purchase_price: number }; changed: boolean; below_cost: boolean; new_margin: number | null }
interface ImportResult { sku: string; action: 'create' | 'update' | 'unchanged' | 'error'; changes?: string[]; message?: string }

const EMPTY = { sku: '', name: '', barcode: '', brand: '', description: '', category_id: '', supplier_id: '', purchase_price: '', selling_price: '', unit_type: 'pcs', reorder_level: '10', reorder_quantity: '50' }
const PAGE = 50
const pct = (m: number | null) => (m === null ? '-' : `${(m * 100).toFixed(1)}%`)

// Header aliases so a spreadsheet exported from another system still imports.
const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'kode', 'kode produk', 'kode barang'],
  name: ['name', 'nama', 'nama produk', 'nama barang'],
  category: ['category', 'kategori'],
  barcode: ['barcode', 'kode batang'],
  purchase_price: ['purchase_price', 'harga beli', 'hpp', 'modal'],
  selling_price: ['selling_price', 'harga jual', 'harga'],
  unit_type: ['unit', 'unit_type', 'satuan'],
  reorder_level: ['reorder_level', 'titik pesan', 'min stok', 'stok minimum'],
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('name')
  const [panel, setPanel] = useState<null | 'form' | 'bulk' | 'import'>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedKind, setExpandedKind] = useState<'units' | 'history'>('units')
  const [history, setHistory] = useState<PriceChange[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState({ field: 'selling_price', mode: 'percent', value: '10', round: '0' })
  const [bulkPreview, setBulkPreview] = useState<{ summary: { matched: number; changed: number; below_cost: number }; changes: BulkChange[] } | null>(null)
  const [csvText, setCsvText] = useState('')
  const [importPreview, setImportPreview] = useState<{ summary: { create: number; update: number; unchanged: number; errors: number; new_categories: number }; results: ImportResult[] } | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE), sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (categoryFilter) params.set('category_id', categoryFilter)
    if (statusFilter) params.set('status', statusFilter)
    const [pRes, cRes, sRes] = await Promise.all([fetch(`/api/products?${params}`), fetch('/api/product-categories'), fetch('/api/suppliers')])
    const [pData, cData, sData] = await Promise.all([pRes.json(), cRes.json(), sRes.json()])
    if (pRes.ok) {
      setProducts(pData.data ?? [])
      setSummary(pData.summary ?? null)
      setPages(pData.pagination?.pages ?? 1)
      setTotal(pData.pagination?.total ?? 0)
    }
    if (cRes.ok) setCategories((cData.categories ?? []).map((c: Option) => ({ id: c.id, name: c.name })))
    if (sRes.ok) setSuppliers((sData.suppliers ?? []).map((s: Option) => ({ id: s.id, name: s.name })))
    setIsLoading(false)
  }, [page, debouncedSearch, categoryFilter, statusFilter, sort])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  function startEdit(p: Product) {
    setForm({
      sku: p.sku, name: p.name, barcode: p.barcode ?? '', brand: p.brand ?? '', description: p.description ?? '', category_id: p.category_id ?? '', supplier_id: p.supplier_id ?? '',
      purchase_price: String(p.purchase_price), selling_price: String(p.selling_price), unit_type: p.unit_type, reorder_level: String(p.reorder_level), reorder_quantity: String(p.reorder_quantity),
    })
    setEditingId(p.id)
    setPanel('form')
    setError(null)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const num = (v: string) => Number(v)
      const res = editingId
        ? await fetch(`/api/products/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: form.sku, name: form.name, barcode: form.barcode || null, brand: form.brand || null, description: form.description || null, category_id: form.category_id || null, supplier_id: form.supplier_id || null,
              purchase_price: num(form.purchase_price), selling_price: num(form.selling_price), unit_type: form.unit_type, reorder_level: num(form.reorder_level), reorder_quantity: num(form.reorder_quantity),
            }),
          })
        : await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: form.sku, name: form.name, barcode: form.barcode || undefined, category_id: form.category_id || undefined, supplier_id: form.supplier_id || undefined,
              purchase_price: num(form.purchase_price), selling_price: num(form.selling_price), unit_type: form.unit_type, reorder_level: num(form.reorder_level), reorder_quantity: num(form.reorder_quantity),
            }),
          })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
      showToast(editingId ? 'Produk diperbarui' : `Produk "${form.name}" ditambahkan`, 'success')
      setForm(EMPTY)
      setEditingId(null)
      setPanel(null)
      load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(p: Product) {
    const res = await fetch(`/api/products/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !p.is_active }) })
    if (res.ok) load()
  }

  async function remove(p: Product) {
    if (!window.confirm(`Hapus produk "${p.name}"? Riwayat penjualan tetap tersimpan.`)) return
    const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Produk dihapus', 'success')
      load()
    }
  }

  async function openHistory(p: Product) {
    if (expandedId === p.id && expandedKind === 'history') return setExpandedId(null)
    const res = await fetch(`/api/products/${p.id}/history`)
    const data = await res.json()
    setHistory(res.ok ? data.changes ?? [] : [])
    setExpandedKind('history')
    setExpandedId(p.id)
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function runBulk(dry: boolean) {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: Array.from(selected), field: bulk.field, rule: { mode: bulk.mode, value: Number(bulk.value) }, round: Number(bulk.round), dry_run: dry }),
      })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian')
      if (dry) return setBulkPreview(data)
      showToast(`${data.summary.changed} produk diperbarui`, 'success')
      setBulkPreview(null)
      setSelected(new Set())
      setPanel(null)
      load()
    } finally {
      setBusy(false)
    }
  }

  function parseImport() {
    const table = parseCsvTable(csvText)
    const pick = (values: Record<string, string>, key: string) => {
      const alias = ALIASES[key].find((a) => a in values)
      return alias ? values[alias] : ''
    }
    return table.rows.map((r) => {
      const num = (k: string) => {
        const v = pick(r.values, k)
        return v === '' ? undefined : parseNumber(v)
      }
      const row: Record<string, unknown> = { sku: pick(r.values, 'sku') }
      for (const k of ['name', 'category', 'barcode', 'unit_type']) if (pick(r.values, k)) row[k] = pick(r.values, k)
      for (const k of ['purchase_price', 'selling_price', 'reorder_level']) {
        const n = num(k)
        if (n !== undefined) row[k] = n
      }
      return row
    })
  }

  async function runImport(dry: boolean) {
    setError(null)
    const rows = parseImport()
    if (rows.length === 0) return setError('Tempel data dengan baris judul (mis. sku, nama, kategori, harga beli, harga jual, satuan)')
    setBusy(true)
    try {
      const res = await fetch('/api/products/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, dry_run: dry }) })
      const data = await res.json()
      if (data.results) setImportPreview({ summary: data.summary, results: data.results })
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Periksa kembali data Anda')
      if (!dry) {
        showToast(`Impor selesai: ${data.summary.create} baru, ${data.summary.update} diperbarui`, 'success')
        setImportPreview(null)
        setCsvText('')
        setPanel(null)
        load()
      }
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))
  const select = 'rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Card><p className="text-xs text-gray-500">Total Produk</p><p className="text-xl font-bold text-gray-900">{summary.total}</p><p className="text-xs text-gray-400">{summary.inactive} nonaktif</p></Card>
          <Card><button className="text-left" onClick={() => setCategoryFilter('none')}><p className="text-xs text-gray-500">Tanpa Kategori</p><p className={`text-xl font-bold ${summary.no_category ? 'text-amber-600' : 'text-gray-900'}`}>{summary.no_category}</p></button></Card>
          <Card><p className="text-xs text-gray-500">Tanpa Supplier</p><p className={`text-xl font-bold ${summary.no_supplier ? 'text-amber-600' : 'text-gray-900'}`}>{summary.no_supplier}</p><p className="text-xs text-gray-400">tak bisa dibuat PO</p></Card>
          <Card><p className="text-xs text-gray-500">Margin di Bawah 10%</p><p className={`text-xl font-bold ${summary.low_margin ? 'text-amber-600' : 'text-gray-900'}`}>{summary.low_margin}</p></Card>
          <Card><p className="text-xs text-gray-500">Dijual di Bawah Modal</p><p className={`text-xl font-bold ${summary.below_cost ? 'text-red-600' : 'text-gray-900'}`}>{summary.below_cost}</p></Card>
          <Card><p className="text-xs text-gray-500">Dipilih</p><p className="text-xl font-bold text-gray-900">{selected.size}</p></Card>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Cari nama, SKU, barcode…" aria-label="Cari produk" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Filter kategori" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }} className={select}>
          <option value="">Semua Kategori</option>
          <option value="none">Tanpa kategori</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select aria-label="Filter status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={select}>
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <select aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value)} className={select}>
          <option value="name">Nama A–Z</option>
          <option value="newest">Terbaru</option>
          <option value="price_high">Harga jual tertinggi</option>
          <option value="price_low">Harga jual terendah</option>
        </select>
        <ExportCsvButton filename="produk" rows={products.map((p) => ({ SKU: p.sku, Nama: p.name, Kategori: catName(p.category_id) ?? '', Barcode: p.barcode ?? '', 'Harga Beli': p.purchase_price, 'Harga Jual': p.selling_price, 'Margin %': p.selling_price > 0 ? ((marginOf(p.purchase_price, p.selling_price) ?? 0) * 100).toFixed(1) : '', Satuan: p.unit_type, 'Titik Pesan': p.reorder_level, Aktif: p.is_active ? 'Ya' : 'Tidak' }))} />
        <Button size="sm" variant="secondary" onClick={() => { setPanel(panel === 'import' ? null : 'import'); setError(null) }}>Impor CSV</Button>
        <Button size="sm" variant="secondary" disabled={selected.size === 0} onClick={() => { setPanel(panel === 'bulk' ? null : 'bulk'); setBulkPreview(null); setError(null) }}>Ubah Harga Massal ({selected.size})</Button>
        <Button size="sm" onClick={() => { setPanel(panel === 'form' && !editingId ? null : 'form'); setEditingId(null); setForm(EMPTY); setError(null) }}>+ Tambah Produk</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {panel === 'form' && (
        <form onSubmit={save} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <p className="font-medium text-gray-900 sm:col-span-3">{editingId ? 'Ubah produk' : 'Produk baru'}</p>
          <Input name="p_sku" label="SKU" required value={form.sku} onChange={(e) => set({ sku: e.target.value })} />
          <Input name="p_name" label="Nama" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          <Input name="p_barcode" label="Barcode" value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} />
          <div className="space-y-1">
            <label htmlFor="p_category" className="block text-sm font-medium text-gray-700">Kategori</label>
            <select id="p_category" value={form.category_id} onChange={(e) => set({ category_id: e.target.value })} className={`w-full ${select}`}>
              <option value="">— Tanpa kategori —</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="p_supplier" className="block text-sm font-medium text-gray-700">Supplier</label>
            <select id="p_supplier" value={form.supplier_id} onChange={(e) => set({ supplier_id: e.target.value })} className={`w-full ${select}`}>
              <option value="">— Tanpa supplier —</option>
              {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <Input name="p_unit" label="Satuan" required value={form.unit_type} onChange={(e) => set({ unit_type: e.target.value })} />
          <Input name="p_purchase" label="Harga Beli (Rp)" type="number" min="0" required value={form.purchase_price} onChange={(e) => set({ purchase_price: e.target.value })} />
          <Input name="p_selling" label="Harga Jual (Rp)" type="number" min="0" required value={form.selling_price} onChange={(e) => set({ selling_price: e.target.value })} />
          <p className="self-end pb-2 text-sm text-gray-500">Margin: <strong className="text-gray-900">{pct(marginOf(Number(form.purchase_price) || 0, Number(form.selling_price) || 0))}</strong></p>
          <Input name="p_reorder" label="Titik Pesan" type="number" min="0" value={form.reorder_level} onChange={(e) => set({ reorder_level: e.target.value })} />
          <Input name="p_reorder_qty" label="Jumlah Pesan Standar" type="number" min="0" value={form.reorder_quantity} onChange={(e) => set({ reorder_quantity: e.target.value })} />
          <div className="flex items-end gap-2">
            <Button type="submit" isLoading={busy}>{editingId ? 'Simpan Perubahan' : 'Simpan'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setPanel(null); setEditingId(null) }}>Batal</Button>
          </div>
        </form>
      )}

      {panel === 'bulk' && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Ubah harga {selected.size} produk terpilih</h2>
          <div className="flex flex-wrap items-end gap-3">
            <select aria-label="Harga yang diubah" value={bulk.field} onChange={(e) => setBulk((b) => ({ ...b, field: e.target.value }))} className={select}>
              <option value="selling_price">Harga jual</option>
              <option value="purchase_price">Harga beli</option>
            </select>
            <select aria-label="Aturan" value={bulk.mode} onChange={(e) => setBulk((b) => ({ ...b, mode: e.target.value }))} className={select}>
              <option value="percent">Naik/turun persen (%)</option>
              <option value="amount">Tambah/kurang nominal (Rp)</option>
              <option value="margin">Atur margin target (%)</option>
              <option value="set">Setel harga tepat (Rp)</option>
            </select>
            <Input name="bulk_value" label="Nilai" type="number" value={bulk.value} onChange={(e) => setBulk((b) => ({ ...b, value: e.target.value }))} />
            <select aria-label="Pembulatan" value={bulk.round} onChange={(e) => setBulk((b) => ({ ...b, round: e.target.value }))} className={select}>
              <option value="0">Tanpa pembulatan</option>
              <option value="100">Bulatkan ke Rp 100</option>
              <option value="500">Bulatkan ke Rp 500</option>
              <option value="1000">Bulatkan ke Rp 1.000</option>
            </select>
            <Button variant="secondary" onClick={() => runBulk(true)} isLoading={busy}>Pratinjau</Button>
            <Button onClick={() => runBulk(false)} isLoading={busy} disabled={!bulkPreview || bulkPreview.summary.changed === 0}>Terapkan</Button>
          </div>
          {bulkPreview && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{bulkPreview.summary.changed} produk berubah dari {bulkPreview.summary.matched}{bulkPreview.summary.below_cost > 0 && <span className="ml-2 font-medium text-red-600">⚠ {bulkPreview.summary.below_cost} akan dijual di bawah modal</span>}</p>
              <div className="max-h-72 overflow-y-auto rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {bulkPreview.changes.filter((c) => c.changed).map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-1.5 text-gray-900">{c.name}<span className="ml-1 text-xs text-gray-400">{c.sku}</span></td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{formatCurrency(bulk.field === 'purchase_price' ? c.old.purchase_price : c.old.selling_price)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-gray-900">→ {formatCurrency(bulk.field === 'purchase_price' && bulk.mode !== 'margin' ? c.new.purchase_price : c.new.selling_price)}</td>
                        <td className={`px-3 py-1.5 text-right text-xs ${c.below_cost ? 'font-semibold text-red-600' : 'text-gray-400'}`}>margin {pct(c.new_margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {panel === 'import' && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Impor / perbarui produk dari spreadsheet</h2>
          <p className="text-sm text-gray-500">Tempel dari Excel/Sheets atau CSV dengan baris judul: <code>sku, nama, kategori, barcode, harga beli, harga jual, satuan, titik pesan</code>. SKU yang sudah ada diperbarui; produk baru butuh nama dan kedua harga. Selalu klik Periksa dulu.</p>
          <textarea aria-label="Data CSV produk" rows={7} value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full rounded-sm border border-gray-200 px-3 py-2 font-mono text-sm" placeholder={'sku,nama,kategori,harga beli,harga jual,satuan\nKOPI-01,Kopi Susu,Minuman,8000,15000,cup'} />
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv,.txt" aria-label="Unggah CSV" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsvText(await f.text()) }} className="text-sm" />
            <Button variant="secondary" onClick={() => runImport(true)} isLoading={busy}>Periksa (tanpa menyimpan)</Button>
            <Button onClick={() => runImport(false)} isLoading={busy} disabled={!importPreview || importPreview.summary.errors > 0 || importPreview.summary.create + importPreview.summary.update === 0}>Terapkan Impor</Button>
          </div>
          {importPreview && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{importPreview.summary.create} baru · {importPreview.summary.update} diperbarui · {importPreview.summary.unchanged} tetap · <span className={importPreview.summary.errors ? 'font-medium text-red-600' : ''}>{importPreview.summary.errors} bermasalah</span>{importPreview.summary.new_categories > 0 && ` · ${importPreview.summary.new_categories} kategori baru dibuat`}</p>
              <div className="max-h-72 overflow-y-auto rounded border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {importPreview.results.filter((r) => r.action !== 'unchanged').map((r) => (
                      <tr key={r.sku}>
                        <td className="px-3 py-1.5 font-mono text-gray-900">{r.sku}</td>
                        <td className={`px-3 py-1.5 ${r.action === 'error' ? 'text-red-600' : r.action === 'create' ? 'text-emerald-600' : 'text-gray-700'}`}>{r.action === 'create' ? 'Baru' : r.action === 'update' ? 'Perbarui' : 'Error'}</td>
                        <td className="px-3 py-1.5 text-xs text-gray-500">{r.message ?? r.changes?.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2"><input type="checkbox" aria-label="Pilih semua di halaman ini" checked={products.length > 0 && products.every((p) => selected.has(p.id))} onChange={(e) => setSelected((s) => { const n = new Set(s); products.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id))); return n })} /></th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Kategori</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga Beli</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga Jual</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Margin</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Tidak ada produk ditemukan</td></tr>
            ) : (
              products.map((p) => {
                const m = marginOf(p.purchase_price, p.selling_price)
                return (
                  <Fragment key={p.id}>
                    <tr className={`hover:bg-gray-50 ${p.is_active ? '' : 'opacity-60'}`}>
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Pilih ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                      <td className="px-3 py-2 text-gray-900">{p.name}<span className="block text-xs text-gray-400">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</span></td>
                      <td className="px-3 py-2 text-gray-600">{catName(p.category_id) ?? <span className="text-amber-600">—</span>}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.purchase_price)}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(p.selling_price)} <span className="text-xs text-gray-400">/{p.unit_type}</span></td>
                      <td className={`px-3 py-2 text-right ${m !== null && m < 0 ? 'font-semibold text-red-600' : m !== null && m < 0.1 ? 'text-amber-600' : 'text-gray-600'}`}>{pct(m)}</td>
                      <td className="px-3 py-2 text-gray-600">{p.is_active ? 'Aktif' : 'Nonaktif'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                        <button className="text-brand-600 hover:underline" onClick={() => startEdit(p)}>Ubah</button>
                        <button className="ml-3 text-brand-600 hover:underline" onClick={() => openHistory(p)}>Riwayat Harga</button>
                        <button className="ml-3 text-brand-600 hover:underline" onClick={() => { setExpandedKind('units'); setExpandedId(expandedId === p.id && expandedKind === 'units' ? null : p.id) }}>Satuan</button>
                        <button className="ml-3 text-gray-500 hover:underline" onClick={() => toggleActive(p)}>{p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button className="ml-3 text-red-600 hover:underline" onClick={() => remove(p)}>Hapus</button>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-3">
                          {expandedKind === 'units' ? (
                            <ProductUnitsEditor productId={p.id} baseUnitLabel={p.unit_type} baseUnitPrice={p.selling_price} />
                          ) : history.length === 0 ? (
                            <p className="text-sm text-gray-400">Belum ada perubahan harga tercatat.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {history.map((h) => (
                                <li key={h.id} className="flex flex-wrap gap-x-4 text-gray-700">
                                  <span className="text-gray-400">{formatDateTime(h.changed_at)}</span>
                                  {h.old_selling_price !== h.new_selling_price && <span>Jual {formatCurrency(h.old_selling_price ?? 0)} → <strong>{formatCurrency(h.new_selling_price ?? 0)}</strong></span>}
                                  {h.old_purchase_price !== h.new_purchase_price && <span>Beli {formatCurrency(h.old_purchase_price ?? 0)} → <strong>{formatCurrency(h.new_purchase_price ?? 0)}</strong></span>}
                                  {h.changed_by_name && <span className="text-gray-400">oleh {h.changed_by_name}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} produk · halaman {page} dari {pages}</span>
          <div className="flex gap-2">
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelumnya</button>
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
          </div>
        </div>
      )}
    </div>
  )
}
