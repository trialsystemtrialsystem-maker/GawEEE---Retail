'use client'

import { useEffect, useState } from 'react'

interface OutletOption {
  id: string
  name: string
}

// "Semua Outlet" (all outlets combined) vs. a specific one, for reports that
// support a master_admin viewing their whole company at once. Resolves
// against GET /api/outlets, which returns every outlet in the caller's
// company for a master_admin or just their own single outlet otherwise — so
// this renders the same either way, it just won't offer anything to choose
// beyond "Semua Outlet" for a non-master_admin (harmless, and one fewer
// special case to carry through every report that uses it).
export function OutletSelector({
  value,
  onChange,
  includeAll = true,
}: {
  value: string
  onChange: (outletId: string) => void
  /** Set false for callers whose backing route doesn't understand
   * outlet_id=all (e.g. the accounting family, which uses canAccessOutlet()
   * against a single real outlet id rather than resolveOutletScope()) — the
   * caller is responsible for seeding `value` with a real outlet id instead
   * of the 'all' sentinel in that case. */
  includeAll?: boolean
}) {
  const [outlets, setOutlets] = useState<OutletOption[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch('/api/outlets')
      const data = await res.json()
      if (res.ok) setOutlets(data.outlets ?? [])
    }, 0)
    return () => clearTimeout(t)
  }, [])

  if (outlets.length <= 1) return null

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-sm border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
    >
      {includeAll && <option value="all">Semua Outlet</option>}
      {outlets.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}
