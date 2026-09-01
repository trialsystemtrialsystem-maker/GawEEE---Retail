'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface ProductUnit {
  id: string
  unit_label: string
  conversion_to_base: number
  unit_price: number
}

// Embedded as an expandable row under a product in ProductList — lets a
// product be sold as a larger unit (e.g. "Dus") alongside its base unit.
// See Phase 11 plan item 10 (Multi-UOM).
export function ProductUnitsEditor({ productId, baseUnitLabel, baseUnitPrice }: { productId: string; baseUnitLabel: string; baseUnitPrice: number }) {
  const [units, setUnits] = useState<ProductUnit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [conversion, setConversion] = useState('')
  const [price, setPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/product-units?product_id=${productId}`)
    const data = await res.json()
    if (res.ok) setUnits(data.units ?? [])
    setIsLoading(false)
  }, [productId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/product-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          unit_label: label,
          conversion_to_base: Number(conversion),
          unit_price: Number(price),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah satuan', 'danger')
        return
      }
      setLabel('')
      setConversion('')
      setPrice('')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(unit: ProductUnit) {
    setBusyId(unit.id)
    try {
      await fetch(`/api/product-units/${unit.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3 bg-gray-50 p-4 text-sm">
      <p className="text-gray-500">
        Satuan dasar: <span className="font-medium text-gray-700">{baseUnitLabel}</span> — {formatCurrency(baseUnitPrice)}
      </p>

      {isLoading ? (
        <p className="text-gray-400">Memuat…</p>
      ) : units.length === 0 ? (
        <p className="text-gray-400">Belum ada satuan tambahan</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {units.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-3 py-2">
              <span>
                {u.unit_label} ({u.conversion_to_base}x {baseUnitLabel}) — {formatCurrency(u.unit_price)}
              </span>
              <button
                type="button"
                disabled={busyId === u.id}
                onClick={() => handleDelete(u)}
                className="text-red-500 hover:underline disabled:opacity-50"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <Input label="Nama Satuan" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mis. Dus" className="w-32" />
        <Input
          label={`Isi (x ${baseUnitLabel})`}
          type="number"
          min={2}
          required
          value={conversion}
          onChange={(e) => setConversion(e.target.value)}
          className="w-28"
        />
        <Input label="Harga Satuan (Rp)" type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-36" />
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          + Tambah Satuan
        </Button>
      </form>
    </div>
  )
}
