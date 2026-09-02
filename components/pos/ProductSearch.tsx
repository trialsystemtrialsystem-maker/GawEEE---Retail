'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'
import { UnitPickerModal } from '@/components/pos/UnitPickerModal'
import { colorForIndex } from '@/lib/utils/chartColors'

interface InventoryItem {
  product_id: string
  name: string
  sku: string
  barcode: string | null
  category_name: string | null
  unit_price: number
  quantity_available: number
}
interface ProductUnit {
  id: string
  product_id: string
  unit_label: string
  conversion_to_base: number
  unit_price: number
}

export function ProductSearch({ outletId }: { outletId: string }) {
  const [query, setQuery] = useState('')
  const [allProducts, setAllProducts] = useState<InventoryItem[]>([])
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, ProductUnit[]>>({})
  const [unitPickerItem, setUnitPickerItem] = useState<InventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = usePosStore((s) => s.addItem)

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [invRes, unitsRes] = await Promise.all([fetch(`/api/inventory/${outletId}`), fetch('/api/product-units')])
      const invData = await invRes.json()
      const unitsData = await unitsRes.json()
      setAllProducts(invData.inventory ?? [])
      if (unitsRes.ok) {
        const grouped: Record<string, ProductUnit[]> = {}
        for (const u of (unitsData.units ?? []) as ProductUnit[]) {
          ;(grouped[u.product_id] ??= []).push(u)
        }
        setUnitsByProduct(grouped)
      }
    } finally {
      setIsLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(loadAll, 0)
    return () => clearTimeout(timeout)
  }, [loadAll])

  async function handleBarcodeEnter() {
    if (!query.trim()) return
    setNotFound(null)
    const res = await fetch(`/api/inventory/${outletId}?barcode=${encodeURIComponent(query.trim())}`)
    const data = await res.json()
    const match: InventoryItem | undefined = data.inventory?.[0]
    if (match) {
      handleAdd(match)
    } else {
      setNotFound(`Barcode "${query}" tidak ditemukan`)
    }
  }

  function handleAdd(item: InventoryItem) {
    addItem({ product_id: item.product_id, name: item.name, sku: item.sku, unit_price: item.unit_price })
    setQuery('')
    setNotFound(null)
    inputRef.current?.focus()
    loadAll() // refresh so stock counts on the grid reflect the new cart draw-down risk at a glance
  }

  // Tile clicks (unlike a barcode scan, which always resolves to the base
  // unit) offer a unit picker when the product has extra units defined.
  function handleTileClick(item: InventoryItem) {
    const units = unitsByProduct[item.product_id]
    if (units?.length) {
      setUnitPickerItem(item)
      return
    }
    handleAdd(item)
  }

  function handleUnitPick(args: { unitPrice: number; quantity: number; discount?: number; unitLabel?: string; unitQuantity?: number }) {
    if (!unitPickerItem) return
    addItem(
      {
        product_id: unitPickerItem.product_id,
        name: unitPickerItem.name,
        sku: unitPickerItem.sku,
        unit_price: args.unitPrice,
        discount: args.discount,
        unit_label: args.unitLabel,
        unit_quantity: args.unitQuantity,
      },
      args.quantity
    )
    setUnitPickerItem(null)
    loadAll()
  }

  const needle = query.trim().toLowerCase()
  const visibleProducts = needle ? allProducts.filter((p) => p.name.toLowerCase().includes(needle)) : allProducts

  const categoryNames = Array.from(new Set(allProducts.map((p) => p.category_name ?? '—')))
  const colorForCategory = (name: string | null) => colorForIndex(categoryNames.indexOf(name ?? '—'))

  return (
    <div className="space-y-3">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setNotFound(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleBarcodeEnter()
          }}
          placeholder="Scan barcode atau cari produk"
          autoFocus
          className="w-full rounded-xl border-2 border-[var(--brand-100)] py-3 pl-11 pr-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        />
      </div>

      {notFound && <p className="text-sm text-[var(--color-danger)]">{notFound}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Memuat produk…</p>
      ) : visibleProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Produk tidak ditemukan</p>
      ) : (
        <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((item) => {
            const outOfStock = item.quantity_available <= 0
            const lowStock = !outOfStock && item.quantity_available <= 10
            const accent = colorForCategory(item.category_name)
            return (
              <button
                key={item.product_id}
                type="button"
                onClick={() => handleTileClick(item)}
                disabled={outOfStock}
                style={{ borderColor: outOfStock ? undefined : `color-mix(in srgb, ${accent} 35%, white)` }}
                className="relative flex flex-col items-center gap-2 rounded-xl border-2 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                {lowStock && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--status-warning)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Sisa {item.quantity_available}
                  </span>
                )}
                <span
                  aria-hidden
                  style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, white)` }}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                >
                  {getProductIcon({ name: item.name, categoryName: item.category_name })}
                </span>
                <div className="w-full">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="mt-0.5 text-sm font-bold" style={{ color: accent }}>
                    {formatCurrency(item.unit_price)}
                  </p>
                  <p className={`text-xs ${outOfStock ? 'font-semibold text-[var(--color-danger)]' : 'text-gray-400'}`}>
                    {outOfStock ? 'Stok habis' : `Stok ${item.quantity_available}`}
                  </p>
                  {(unitsByProduct[item.product_id]?.length ?? 0) > 0 && (
                    <p className="text-xs font-medium text-[var(--brand-600)]">+ satuan lain</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {unitPickerItem && (
        <UnitPickerModal
          item={unitPickerItem}
          units={unitsByProduct[unitPickerItem.product_id] ?? []}
          onPick={handleUnitPick}
          onClose={() => setUnitPickerItem(null)}
        />
      )}
    </div>
  )
}
