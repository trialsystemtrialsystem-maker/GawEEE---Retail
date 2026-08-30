'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'

interface InventoryItem {
  product_id: string
  name: string
  sku: string
  barcode: string | null
  category_name: string | null
  unit_price: number
  quantity_available: number
}

export function ProductSearch({ outletId }: { outletId: string }) {
  const [query, setQuery] = useState('')
  const [allProducts, setAllProducts] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = usePosStore((s) => s.addItem)

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/inventory/${outletId}`)
      const data = await res.json()
      setAllProducts(data.inventory ?? [])
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

  const needle = query.trim().toLowerCase()
  const visibleProducts = needle ? allProducts.filter((p) => p.name.toLowerCase().includes(needle)) : allProducts

  return (
    <div className="space-y-3">
      <div className="relative">
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
          className="w-full rounded-md border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {notFound && <p className="text-sm text-red-500">{notFound}</p>}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Memuat produk…</p>
      ) : visibleProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Produk tidak ditemukan</p>
      ) : (
        <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((item) => {
            const outOfStock = item.quantity_available <= 0
            return (
              <button
                key={item.product_id}
                type="button"
                onClick={() => handleAdd(item)}
                disabled={outOfStock}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-center transition hover:border-blue-400 hover:shadow-md disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:shadow-none"
              >
                <div className="w-full">
                  <p className="line-clamp-2 text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatCurrency(item.unit_price)}</p>
                  <p className={`text-xs ${outOfStock ? 'text-red-500' : 'text-gray-400'}`}>
                    {outOfStock ? 'Stok habis' : `Stok ${item.quantity_available}`}
                  </p>
                </div>
                {/* Category symbol, anchored at the bottom of the tile */}
                <span
                  aria-hidden
                  className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl"
                >
                  {getProductIcon({ name: item.name, categoryName: item.category_name })}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
