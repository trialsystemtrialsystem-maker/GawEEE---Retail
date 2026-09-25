'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Header control for owners (master_admin, not tied to one outlet): picks the
// outlet that outlet-scoped pages and the notification bell work with.
export function OutletSwitcher({ outlets, activeId }: { outlets: { id: string; name: string }[]; activeId?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function change(id: string) {
    setBusy(true)
    try {
      await fetch('/api/outlets/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: id }) })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (outlets.length < 2) return null
  return (
    <label className="hidden items-center gap-1 text-xs text-gray-500 lg:flex">
      Outlet aktif
      <select
        aria-label="Outlet aktif"
        value={activeId ?? ''}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className="max-w-[12rem] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800"
      >
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  )
}
