'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface PO {
  id: string
  po_number: string
  order_date: string
  total: number
  suppliers: { name: string } | null
}

export function PurchasingApprovals() {
  const [orders, setOrders] = useState<PO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/purchase-orders?status=pending_approval')
    const data = await res.json()
    if (res.ok) setOrders(data.purchase_orders ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id)
    try {
      const res = await fetch(`/api/purchase-orders/${id}/${action}`, { method: 'POST' })
      if (res.ok) {
        showToast(action === 'approve' ? 'PO disetujui' : 'PO ditolak', 'success')
        load()
      } else {
        showToast('Gagal memproses PO', 'danger')
      }
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) return <p className="text-sm text-gray-400">Memuat…</p>
  if (orders.length === 0) return <Alert variant="info">Tidak ada Purchase Order yang menunggu persetujuan.</Alert>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">No. PO</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Supplier</th>
            <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {orders.map((po) => (
            <tr key={po.id}>
              <td className="px-4 py-2 font-mono text-xs text-gray-700">{po.po_number}</td>
              <td className="px-4 py-2 text-gray-600">{formatDate(po.order_date)}</td>
              <td className="px-4 py-2 text-gray-900">{po.suppliers?.name ?? '-'}</td>
              <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(po.total)}</td>
              <td className="px-4 py-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => decide(po.id, 'approve')}
                    disabled={busyId === po.id}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => decide(po.id, 'reject')}
                    disabled={busyId === po.id}
                    className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
