'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { formatCurrency } from '@/lib/utils/formatting'
import { getProductIcon } from '@/lib/utils/productIcon'

interface NotePreset {
  id: string
  label: string
}

export function ShoppingCart({ outletId }: { outletId?: string }) {
  const items = usePosStore((s) => s.items)
  const increment = usePosStore((s) => s.incrementItem)
  const decrement = usePosStore((s) => s.decrementItem)
  const removeItem = usePosStore((s) => s.removeItem)
  const setItemNotes = usePosStore((s) => s.setItemNotes)
  const subtotal = usePosStore((s) => s.subtotal())
  const taxAmount = usePosStore((s) => s.taxAmount())
  const discountAmount = usePosStore((s) => s.discountAmount)
  const total = usePosStore((s) => s.total())

  const [presets, setPresets] = useState<NotePreset[]>([])
  const [notePickerFor, setNotePickerFor] = useState<string | null>(null)

  const loadPresets = useCallback(async () => {
    if (!outletId) return
    const res = await fetch(`/api/note-presets?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setPresets(data.presets ?? [])
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(loadPresets, 0)
    return () => clearTimeout(timeout)
  }, [loadPresets])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span aria-hidden className="text-4xl opacity-40">🛒</span>
        <p className="text-sm text-gray-400">Keranjang masih kosong — scan atau pilih produk</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--brand-700)]">Keranjang ({items.length} item)</h3>
        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
          {items.map((item) => (
            <li key={item.product_id} className="py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-lg">
                    {getProductIcon({ name: item.name })}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {item.name}
                      {item.unit_label && (
                        <span className="ml-1.5 whitespace-nowrap rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-xs font-normal text-[var(--brand-600)]">
                          {item.unit_quantity} {item.unit_label}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(item.unit_price)} × {item.quantity} ={' '}
                      <span className="font-semibold text-gray-700">{formatCurrency(item.unit_price * item.quantity)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    onClick={() => decrement(item.product_id)}
                    className="h-8 w-8 rounded-full border-2 border-[var(--brand-100)] font-bold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    onClick={() => increment(item.product_id)}
                    className="h-8 w-8 rounded-full border-2 border-[var(--brand-100)] font-bold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product_id)}
                    className="ml-1 text-sm text-[var(--color-danger)] hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {outletId && (
                <div className="relative ml-12 mt-1">
                  {item.notes ? (
                    <button
                      type="button"
                      onClick={() => setNotePickerFor(notePickerFor === item.product_id ? null : item.product_id)}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                    >
                      📝 {item.notes}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNotePickerFor(notePickerFor === item.product_id ? null : item.product_id)}
                      className="text-xs text-gray-400 hover:text-[var(--brand-600)] hover:underline"
                    >
                      + Catatan
                    </button>
                  )}

                  {notePickerFor === item.product_id && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-56 space-y-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                      {presets.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-gray-400">Belum ada preset catatan</p>
                      ) : (
                        presets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setItemNotes(item.product_id, p.label)
                              setNotePickerFor(null)
                            }}
                            className="block w-full rounded-sm px-2 py-1 text-left text-xs text-gray-700 hover:bg-[var(--brand-50)]"
                          >
                            {p.label}
                          </button>
                        ))
                      )}
                      <input
                        type="text"
                        placeholder="Tulis catatan lain…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            setItemNotes(item.product_id, e.currentTarget.value.trim())
                            setNotePickerFor(null)
                          }
                        }}
                        className="w-full rounded-sm border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 border-t border-gray-200 pt-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-[var(--status-good)]">
            <span>Diskon</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>PPN 10%</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[var(--brand-900)] to-[var(--brand-700)] px-4 py-3">
        <span className="text-sm font-medium text-white/80">Total</span>
        <span className="text-xl font-extrabold text-white">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
