'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePosStore } from '@/store/posStore'
import { useNotificationStore } from '@/store/notificationStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/formatting'

interface HeldTransaction {
  id: string
  cart_snapshot: { product_id: string; name: string; sku: string; unit_price: number; quantity: number }[]
  discount_amount: number
  discount_reason: string | null
  note: string | null
  created_at: string
}

// "Tahan Transaksi" parks the current cart (e.g. customer stepped away) and
// "Transaksi Tertahan" resumes one. Does not touch checkout itself — see
// Phase 11 plan item 5.
export function HeldTransactionsPanel({ outletId }: { outletId: string }) {
  const [held, setHeld] = useState<HeldTransaction[]>([])
  const [showHoldForm, setShowHoldForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const items = usePosStore((s) => s.items)
  const discountAmount = usePosStore((s) => s.discountAmount)
  const discountReason = usePosStore((s) => s.discountReason)
  const clearCart = usePosStore((s) => s.clearCart)
  const restoreCart = usePosStore((s) => s.restoreCart)

  const load = useCallback(async () => {
    const res = await fetch(`/api/held-transactions?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setHeld(data.held_transactions ?? [])
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleHold(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/held-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          cart_snapshot: items,
          discount_amount: discountAmount,
          discount_reason: discountReason || undefined,
          note: note || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menahan transaksi', 'danger')
        return
      }
      clearCart()
      setNote('')
      setShowHoldForm(false)
      showToast('Transaksi ditahan', 'success')
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResume(tx: HeldTransaction) {
    if (items.length > 0) {
      const ok = window.confirm('Keranjang saat ini akan diganti dengan transaksi tertahan ini. Lanjutkan?')
      if (!ok) return
    }
    setBusyId(tx.id)
    try {
      restoreCart(tx.cart_snapshot, tx.discount_amount, tx.discount_reason ?? '')
      await fetch(`/api/held-transactions/${tx.id}`, { method: 'DELETE' })
      setShowList(false)
      showToast('Transaksi dilanjutkan', 'success')
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDiscard(tx: HeldTransaction) {
    const ok = window.confirm('Hapus transaksi tertahan ini secara permanen?')
    if (!ok) return
    setBusyId(tx.id)
    try {
      await fetch(`/api/held-transactions/${tx.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="relative flex gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={items.length === 0}
        onClick={() => setShowHoldForm((v) => !v)}
      >
        Tahan Transaksi
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setShowList((v) => !v)}>
        Transaksi Tertahan{held.length > 0 ? ` (${held.length})` : ''}
      </Button>

      {showHoldForm && (
        <form
          onSubmit={handleHold}
          className="absolute left-0 top-full z-10 mt-2 w-72 space-y-2 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
        >
          <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Pelanggan ambil dompet" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHoldForm(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Tahan
            </Button>
          </div>
        </form>
      )}

      {showList && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 space-y-2 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">Transaksi Tertahan</p>
          {held.length === 0 ? (
            <p className="text-sm text-gray-400">Tidak ada transaksi tertahan</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {held.map((tx) => {
                const total = tx.cart_snapshot.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) - tx.discount_amount
                return (
                  <li key={tx.id} className="rounded-md border border-gray-100 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{formatCurrency(total)}</span>
                      <span className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleTimeString('id-ID')}</span>
                    </div>
                    <p className="text-xs text-gray-500">{tx.cart_snapshot.length} item{tx.note ? ` · ${tx.note}` : ''}</p>
                    <div className="mt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === tx.id}
                        onClick={() => handleDiscard(tx)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        disabled={busyId === tx.id}
                        onClick={() => handleResume(tx)}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Lanjutkan
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
