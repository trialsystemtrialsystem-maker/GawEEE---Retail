'use client'

import { useEffect, useState } from 'react'

/** Resolves which outlet an accounting-family component should show data
 * for. If `outletIdProp` is given (the page already knows the caller's own
 * outlet), use it as-is with no fetch. Otherwise — a master_admin, whose own
 * `outlet_id` is null — fetch the company's outlet list and default to the
 * first one.
 *
 * Deliberately never defaults to the 'all' sentinel `<OutletSelector>` uses
 * for report pages: every accounting-family route
 * (/api/accounting/accounts, /journal-entries, /ledger, /reports) checks
 * `canAccessOutlet(auth, outletId)` against a single real outlet id, not
 * `resolveOutletScope()`'s 'all' aggregation — passing the literal string
 * "all" there would 403. Callers should render
 * `<OutletSelector includeAll={false} value={selectedOutlet}
 * onChange={setSelectedOutlet} />` only when `!outletIdProp`. */
export function useResolvedOutlet(outletIdProp?: string) {
  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [isResolving, setIsResolving] = useState(!outletIdProp)

  useEffect(() => {
    if (outletIdProp) return
    let cancelled = false
    const timeout = setTimeout(async () => {
      const res = await fetch('/api/outlets')
      const data = await res.json()
      if (cancelled) return
      if (res.ok && data.outlets?.length) setSelectedOutlet(data.outlets[0].id)
      setIsResolving(false)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [outletIdProp])

  return {
    outletId: outletIdProp ?? selectedOutlet,
    isResolving: !outletIdProp && isResolving,
    selectedOutlet,
    setSelectedOutlet,
  }
}
