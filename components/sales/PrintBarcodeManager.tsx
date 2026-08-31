'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: number
}

function Label({ product }: { product: Product }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !product.barcode) return
    try {
      JsBarcode(svgRef.current, product.barcode, { format: 'CODE128', width: 1.5, height: 40, fontSize: 12, margin: 4 })
    } catch {
      // invalid barcode value for CODE128 — leave the SVG empty rather than crash the page
    }
  }, [product.barcode])

  return (
    <div className="flex w-44 flex-col items-center gap-1 rounded border border-gray-300 p-2 text-center break-inside-avoid">
      <p className="w-full truncate text-xs font-medium text-gray-900">{product.name}</p>
      <p className="text-xs text-gray-500">{formatCurrency(product.selling_price)}</p>
      {product.barcode ? <svg ref={svgRef} /> : <p className="text-xs text-gray-400">Tidak ada barcode</p>}
      <p className="font-mono text-[10px] text-gray-400">{product.sku}</p>
    </div>
  )
}

export function PrintBarcodeManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/products?limit=200')
    const data = await res.json()
    if (res.ok) setProducts(data.products ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  const labels = Object.entries(selected).flatMap(([id, qty]) => {
    const product = products.find((p) => p.id === id)
    if (!product) return []
    return Array.from({ length: qty }, (_, i) => <Label key={`${id}-${i}`} product={product} />)
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:hidden">
        <div className="space-y-3">
          <Input placeholder="Cari produk…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
            {isLoading ? (
              <p className="p-4 text-sm text-gray-400">Memuat…</p>
            ) : (
              filtered.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.barcode ?? 'Tidak ada barcode'}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    className="w-16 rounded-sm border border-gray-200 px-2 py-1 text-right text-sm"
                    value={selected[p.id] ?? 0}
                    onChange={(e) => {
                      const qty = Math.max(0, Number(e.target.value) || 0)
                      setSelected((prev) => {
                        const next = { ...prev }
                        if (qty === 0) delete next[p.id]
                        else next[p.id] = qty
                        return next
                      })
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">{labels.length} label siap dicetak</p>
          {labels.length === 0 && <Alert variant="info">Pilih produk &amp; jumlah label di sebelah kiri.</Alert>}
          <Button onClick={() => window.print()} disabled={labels.length === 0}>
            Cetak Label
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">{labels}</div>
    </div>
  )
}
