'use client'

import { useState, useRef } from 'react'
import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'

interface InventoryItem {
  product_id: string
  name: string
  sku: string
  barcode: string | null
  unit_price: number
  quantity_available: number
}

export function ProductSearch({ outletId }: { outletId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InventoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = usePosStore((s) => s.addItem)

  async function search(term: string) {
    if (!term.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/inventory/${outletId}?search=${encodeURIComponent(term)}`)
      const data = await res.json()
      setResults(data.inventory ?? [])
    } finally {
      setIsSearching(false)
    }
  }

  async function handleBarcodeEnter() {
    if (!query.trim()) return
    setNotFound(null)
    const res = await fetch(`/api/inventory/${outletId}?barcode=${encodeURIComponent(query.trim())}`)
    const data = await res.json()
    const match: InventoryItem | undefined = data.inventory?.[0]
    if (match) {
      handleAdd(match)
      setQuery('')
      setResults([])
    } else {
      setNotFound(`Barcode "${query}" tidak ditemukan`)
    }
  }

  function handleAdd(item: InventoryItem) {
    addItem({ product_id: item.product_id, name: item.name, sku: item.sku, unit_price: item.unit_price })
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setNotFound(null)
            search(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleBarcodeEnter()
          }}
          placeholder="Scan barcode atau cari produk"
          autoFocus
          className="w-full rounded-md border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Mencari…</span>
        )}
      </div>

      {notFound && <p className="text-sm text-red-500">{notFound}</p>}

      {results.length > 0 && (
        <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {results.map((item) => (
            <li key={item.product_id}>
              <button
                type="button"
                onClick={() => handleAdd(item)}
                disabled={item.quantity_available <= 0}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-40"
              >
                <span>
                  <span className="font-medium text-gray-900">{item.name}</span>{' '}
                  <span className="text-gray-400">({item.sku})</span>
                </span>
                <span className="text-gray-600">
                  {formatCurrency(item.unit_price)} · stok {item.quantity_available}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
