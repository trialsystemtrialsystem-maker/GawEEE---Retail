'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDateTime } from '@/lib/utils/formatting'

interface QueueItem {
  id: string
  quantity: number
  notes: string | null
  prep_status: 'pending' | 'preparing' | 'ready'
  products: { name: string } | null
  invoices: { invoice_number: string; created_at: string } | null
}

const COLUMNS: { status: QueueItem['prep_status']; label: string; next: QueueItem['prep_status'] | null; accent: string }[] = [
  { status: 'pending', label: 'Menunggu', next: 'preparing', accent: 'border-amber-400 bg-amber-50' },
  { status: 'preparing', label: 'Diproses', next: 'ready', accent: 'border-sky-400 bg-sky-50' },
  { status: 'ready', label: 'Siap', next: null, accent: 'border-emerald-400 bg-emerald-50' },
]
const NEXT_LABEL: Record<QueueItem['prep_status'], string> = { pending: 'Mulai Proses', preparing: 'Tandai Siap', ready: '' }

// A genuine, buildable KDS-lite scoped down from a full kitchen-display
// system — today's service-line items only. See Phase 13 Batch E item 14.
export function KitchenBoard() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/reports/kitchen')
    const data = await res.json()
    if (res.ok) setQueue(data.queue ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdvance(item: QueueItem, next: QueueItem['prep_status']) {
    setBusyId(item.id)
    setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, prep_status: next } : q)))
    try {
      await fetch(`/api/invoice-items/${item.id}/prep-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prep_status: next }),
      })
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = queue.filter((q) => q.prep_status === col.status)
        return (
          <div key={col.status} className={`rounded-xl border-2 ${col.accent} p-3`}>
            <h3 className="mb-3 flex items-center justify-between text-sm font-bold text-gray-700">
              {col.label} <span className="rounded-full bg-white px-2 py-0.5 text-xs">{items.length}</span>
            </h3>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">Kosong</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="font-semibold text-gray-900">{item.products?.name ?? 'Layanan'}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity}x · {item.invoices?.invoice_number}
                    </p>
                    {item.notes && <p className="mt-0.5 text-xs text-gray-500">↳ {item.notes}</p>}
                    {item.invoices?.created_at && <p className="text-[11px] text-gray-400">{formatDateTime(item.invoices.created_at)}</p>}
                    {col.next && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleAdvance(item, col.next!)}
                        className="mt-2 w-full rounded-md bg-gray-900 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                      >
                        {NEXT_LABEL[col.status]}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
