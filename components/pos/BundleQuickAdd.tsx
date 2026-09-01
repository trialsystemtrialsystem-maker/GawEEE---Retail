'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { useNotificationStore } from '@/store/notificationStore'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/formatting'

interface BundleItem {
  product_id: string
  quantity: number
  products: { name: string; sku: string; selling_price: number } | null
}
interface Bundle {
  id: string
  name: string
  bundle_price: number
  product_bundle_items: BundleItem[]
}

// "Tambah Paket" quick-adds every component of a bundle to the cart at
// once. The gap between the components' normal total and the bundle price
// is folded into the cart's existing discount fields (additive to any
// manual discount already applied) — create_invoice() needs no changes,
// same reasoning as Phase 11 plan item 6.
export function BundleQuickAdd({ outletId }: { outletId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [showList, setShowList] = useState(false)
  const addItem = usePosStore((s) => s.addItem)
  const setDiscount = usePosStore((s) => s.setDiscount)
  const discountAmount = usePosStore((s) => s.discountAmount)
  const discountReason = usePosStore((s) => s.discountReason)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const res = await fetch(`/api/product-bundles?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setBundles(data.bundles ?? [])
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  function handleAdd(bundle: Bundle) {
    let normalTotal = 0
    for (const item of bundle.product_bundle_items) {
      if (!item.products) continue
      addItem(
        { product_id: item.product_id, name: item.products.name, sku: item.products.sku, unit_price: item.products.selling_price },
        item.quantity
      )
      normalTotal += item.products.selling_price * item.quantity
    }
    const bundleDiscount = Math.max(0, normalTotal - bundle.bundle_price)
    if (bundleDiscount > 0) {
      const reason = discountReason ? `${discountReason}; Paket: ${bundle.name}` : `Paket: ${bundle.name}`
      setDiscount(discountAmount + bundleDiscount, reason)
    }
    setShowList(false)
    showToast(`Paket "${bundle.name}" ditambahkan`, 'success')
  }

  if (bundles.length === 0) return null

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="sm" onClick={() => setShowList((v) => !v)}>
        Tambah Paket
      </Button>

      {showList && (
        <div className="absolute left-0 top-full z-10 mt-2 w-80 space-y-2 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">Paket Bundling</p>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {bundles.map((b) => (
              <li key={b.id} className="rounded-md border border-gray-100 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{b.name}</span>
                  <span className="text-gray-700">{formatCurrency(b.bundle_price)}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {b.product_bundle_items.map((it) => `${it.products?.name ?? '?'} x${it.quantity}`).join(', ')}
                </p>
                <div className="mt-1 flex justify-end">
                  <button type="button" onClick={() => handleAdd(b)} className="text-xs font-medium text-blue-600 hover:underline">
                    Tambahkan ke Keranjang
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
