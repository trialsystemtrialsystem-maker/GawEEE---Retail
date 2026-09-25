'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

interface Item {
  key: string
  label: string
  count: number
  detail?: string
  severity: 'critical' | 'warning' | 'info'
  href: string
}

const STYLE = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}

export function AttentionCenter({ outletId }: { outletId: string }) {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/dashboard/attention?outlet_id=${outletId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => !cancelled && setItems(d.items ?? []))
      .catch(() => !cancelled && setItems([]))
    return () => {
      cancelled = true
    }
  }, [outletId])

  if (items === null) return null

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Perlu Perhatian</h2>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-600">Semua beres — tidak ada yang menunggu tindakan.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <Link key={i.key} href={i.href} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-opacity hover:opacity-80 ${STYLE[i.severity]}`}>
              <span className="text-2xl font-bold tabular-nums">{i.count}</span>
              <span className="text-sm">
                {i.label}
                {i.detail && <span className="block text-xs opacity-70">{i.detail}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
