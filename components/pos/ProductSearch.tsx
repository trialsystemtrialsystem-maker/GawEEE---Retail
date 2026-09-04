'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'
import { UnitPickerModal } from '@/components/pos/UnitPickerModal'
import { ModifierPickerModal } from '@/components/pos/ModifierPickerModal'
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
interface ModifierOption {
  id: string
  label: string
  linked_product_id: string | null
  products: { name: string; sku: string; selling_price: number } | null
}
interface ModifierGroup {
  id: string
  product_id: string
  name: string
  product_modifier_options: ModifierOption[]
}
interface TimeBasedPrice {
  id: string
  product_id: string
  price: number
  day_of_week: number | null
  start_time: string
  end_time: string
}

export function ProductSearch({ outletId }: { outletId: string }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [allProducts, setAllProducts] = useState<InventoryItem[]>([])
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, ProductUnit[]>>({})
  const [modifiersByProduct, setModifiersByProduct] = useState<Record<string, ModifierGroup[]>>({})
  const [timePricesByProduct, setTimePricesByProduct] = useState<Record<string, TimeBasedPrice[]>>({})
  const [unitPickerItem, setUnitPickerItem] = useState<InventoryItem | null>(null)
  const [modifierPickerItem, setModifierPickerItem] = useState<InventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = usePosStore((s) => s.addItem)
  const setItemNotes = usePosStore((s) => s.setItemNotes)
  const cartItems = usePosStore((s) => s.items)

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [invRes, unitsRes, modifiersRes, timePricesRes] = await Promise.all([
        fetch(`/api/inventory/${outletId}`),
        fetch('/api/product-units'),
        fetch('/api/product-modifiers'),
        fetch('/api/time-based-prices'),
      ])
      const invData = await invRes.json()
      const unitsData = await unitsRes.json()
      const modifiersData = await modifiersRes.json()
      const timePricesData = await timePricesRes.json()
      setAllProducts(invData.inventory ?? [])
      if (unitsRes.ok) {
        const grouped: Record<string, ProductUnit[]> = {}
        for (const u of (unitsData.units ?? []) as ProductUnit[]) {
          ;(grouped[u.product_id] ??= []).push(u)
        }
        setUnitsByProduct(grouped)
      }
      if (modifiersRes.ok) {
        const grouped: Record<string, ModifierGroup[]> = {}
        for (const g of (modifiersData.groups ?? []) as ModifierGroup[]) {
          ;(grouped[g.product_id] ??= []).push(g)
        }
        setModifiersByProduct(grouped)
      }
      if (timePricesRes.ok) {
        const grouped: Record<string, TimeBasedPrice[]> = {}
        for (const tp of (timePricesData.prices ?? []) as TimeBasedPrice[]) {
          ;(grouped[tp.product_id] ??= []).push(tp)
        }
        setTimePricesByProduct(grouped)
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

  // Active window at "now" for a product, if any (day_of_week null = every
  // day). Applied as a per-item discount at add-time, never a markup — zero
  // create_invoice() changes. See Phase 13 Batch C item 8.
  function activeTimePrice(productId: string): TimeBasedPrice | undefined {
    const windows = timePricesByProduct[productId]
    if (!windows?.length) return undefined
    const now = new Date()
    const day = now.getDay()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return windows.find((w) => (w.day_of_week === null || w.day_of_week === day) && w.start_time.slice(0, 5) <= hhmm && hhmm <= w.end_time.slice(0, 5))
  }

  function handleAdd(item: InventoryItem) {
    const window = activeTimePrice(item.product_id)
    const discount = window && window.price < item.unit_price ? item.unit_price - window.price : undefined
    addItem({ product_id: item.product_id, name: item.name, sku: item.sku, unit_price: item.unit_price, discount })
    setQuery('')
    setNotFound(null)
    inputRef.current?.focus()
  }

  // Tile clicks (unlike a barcode scan, which always resolves to the base
  // unit) offer a modifier picker first (if the product has modifier groups
  // defined), then a unit picker (if it has extra units defined).
  function handleTileClick(item: InventoryItem) {
    const modifierGroups = modifiersByProduct[item.product_id]
    if (modifierGroups?.length) {
      setModifierPickerItem(item)
      return
    }
    const units = unitsByProduct[item.product_id]
    if (units?.length) {
      setUnitPickerItem(item)
      return
    }
    handleAdd(item)
  }

  // Priced options (linked_product_id set) are added as their own real cart
  // line — pricing flows through normal checkout with zero function changes.
  // Unpriced options are folded into a note on the base product's line.
  function handleModifierConfirm(selectedOptions: ModifierOption[]) {
    if (!modifierPickerItem) return
    const base = modifierPickerItem
    handleAdd(base)
    const unpricedLabels = selectedOptions.filter((o) => !o.linked_product_id).map((o) => o.label)
    if (unpricedLabels.length > 0) {
      setItemNotes(base.product_id, unpricedLabels.join(', '))
    }
    for (const option of selectedOptions) {
      if (option.linked_product_id && option.products) {
        addItem({ product_id: option.linked_product_id, name: option.products.name, sku: option.products.sku, unit_price: option.products.selling_price })
      }
    }
    setModifierPickerItem(null)
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
  }

  const needle = query.trim().toLowerCase()
  const categoryFiltered = activeCategory ? allProducts.filter((p) => (p.category_name ?? 'Lainnya') === activeCategory) : allProducts
  const visibleProducts = needle ? categoryFiltered.filter((p) => p.name.toLowerCase().includes(needle)) : categoryFiltered

  const categoryNames = Array.from(new Set(allProducts.map((p) => p.category_name ?? '—')))
  const colorForCategory = (name: string | null) => colorForIndex(categoryNames.indexOf(name ?? '—'))

  // Derived, not stored: available stock shown on each tile is server stock
  // minus whatever's already in the cart for that product. Self-corrects on
  // every cart change (add, remove, clear, hold/resume) with no re-fetch —
  // avoids both the old "reload the whole grid on every tap" flash and the
  // staleness a one-shot local decrement would drift into on removal.
  const cartQtyByProduct = new Map(cartItems.map((i) => [i.product_id, i.quantity]))
  const availableStock = (item: InventoryItem) => item.quantity_available - (cartQtyByProduct.get(item.product_id) ?? 0)

  return (
    <div className="space-y-3">
      {categoryNames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeCategory === null ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Semua
          </button>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === cat ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
            const stock = availableStock(item)
            const outOfStock = stock <= 0
            const lowStock = !outOfStock && stock <= 10
            const accent = colorForCategory(item.category_name)
            const window = activeTimePrice(item.product_id)
            const hasSpecialPrice = !!window && window.price < item.unit_price
            return (
              <button
                key={item.product_id}
                type="button"
                onClick={() => handleTileClick(item)}
                disabled={outOfStock}
                style={{ borderTopColor: outOfStock ? '#e5e7eb' : accent }}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-gray-100 border-t-4 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                {lowStock && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--status-warning)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Sisa {stock}
                  </span>
                )}
                {hasSpecialPrice && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">⏰ Promo</span>
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
                  {hasSpecialPrice ? (
                    <p className="mt-0.5 text-sm font-bold">
                      <span className="mr-1 text-xs font-normal text-gray-400 line-through">{formatCurrency(item.unit_price)}</span>
                      <span className="text-rose-600">{formatCurrency(window!.price)}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm font-bold" style={{ color: accent }}>
                      {formatCurrency(item.unit_price)}
                    </p>
                  )}
                  <p className={`text-xs ${outOfStock ? 'font-semibold text-[var(--color-danger)]' : 'text-gray-400'}`}>
                    {outOfStock ? 'Stok habis' : `Stok ${stock}`}
                  </p>
                  {(modifiersByProduct[item.product_id]?.length ?? 0) > 0 ? (
                    <p className="text-xs font-medium text-[var(--brand-600)]">+ pilihan tambahan</p>
                  ) : (
                    (unitsByProduct[item.product_id]?.length ?? 0) > 0 && (
                      <p className="text-xs font-medium text-[var(--brand-600)]">+ satuan lain</p>
                    )
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

      {modifierPickerItem && (
        <ModifierPickerModal
          item={modifierPickerItem}
          groups={modifiersByProduct[modifierPickerItem.product_id] ?? []}
          onConfirm={({ selectedOptions }) => handleModifierConfirm(selectedOptions)}
          onClose={() => setModifierPickerItem(null)}
        />
      )}
    </div>
  )
}
