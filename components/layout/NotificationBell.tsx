'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/formatting'

interface Alert {
  id: string
  title: string
  description: string | null
  severity: string
  created_at: string
}

interface Notifications {
  alerts: Alert[]
  pendingApprovals: { itemRequests: number; expenseRequests: number; purchaseOrders: number }
  lowStockCount: number
}

const SEVERITY_COLOR: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
}

export function NotificationBell({ outletId }: { outletId: string }) {
  const [data, setData] = useState<Notifications | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/notifications?outlet_id=${outletId}`)
    const json = await res.json()
    if (res.ok) setData(json)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    const interval = setInterval(load, 60000)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [load])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function dismiss(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    load()
  }

  const totalApprovals = data
    ? data.pendingApprovals.itemRequests + data.pendingApprovals.expenseRequests + data.pendingApprovals.purchaseOrders
    : 0
  const badgeCount = (data?.alerts.length ?? 0) + totalApprovals + (data?.lowStockCount ?? 0)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
      >
        🔔
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-900">Notifikasi</div>

          {data && totalApprovals > 0 && (
            <div className="border-b border-gray-100 px-4 py-2 text-sm">
              <p className="mb-1 font-medium text-gray-700">Menunggu Persetujuan</p>
              <ul className="space-y-0.5 text-gray-600">
                {data.pendingApprovals.itemRequests > 0 && (
                  <li>
                    <Link href="/dashboard/inventory/purchasing/item-request" className="hover:underline">
                      {data.pendingApprovals.itemRequests} Item Request
                    </Link>
                  </li>
                )}
                {data.pendingApprovals.expenseRequests > 0 && (
                  <li>
                    <Link href="/dashboard/staff/approvals/finance" className="hover:underline">
                      {data.pendingApprovals.expenseRequests} Pengajuan Pengeluaran
                    </Link>
                  </li>
                )}
                {data.pendingApprovals.purchaseOrders > 0 && (
                  <li>
                    <Link href="/dashboard/staff/approvals/purchasing" className="hover:underline">
                      {data.pendingApprovals.purchaseOrders} Purchase Order
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {data && data.lowStockCount > 0 && (
            <div className="border-b border-gray-100 px-4 py-2 text-sm">
              <Link href="/dashboard/inventory?status=low_stock" className="text-amber-700 hover:underline">
                ⚠️ {data.lowStockCount} produk stok rendah
              </Link>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            {!data ? (
              <p className="p-4 text-sm text-gray-400">Memuat…</p>
            ) : data.alerts.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Tidak ada notifikasi baru</p>
            ) : (
              data.alerts.map((a) => (
                <div key={a.id} className="flex gap-2 border-b border-gray-50 px-4 py-2 text-sm last:border-0">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_COLOR[a.severity] ?? 'bg-gray-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{a.title}</p>
                    {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                    <p className="text-xs text-gray-400">{formatDateTime(a.created_at)}</p>
                  </div>
                  <button onClick={() => dismiss(a.id)} className="shrink-0 text-xs text-gray-400 hover:text-gray-700">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
