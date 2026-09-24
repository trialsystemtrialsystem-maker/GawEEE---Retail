'use client'

import { useEffect, useState } from 'react'
import type { FeatureFlags } from '@/lib/nav/features'

interface State {
  flags: FeatureFlags
  isMaster: boolean
}

// One fetch shared by TopNav and Sidebar (both mount on every dashboard page).
let inflight: Promise<State> | null = null
function fetchFlags(): Promise<State> {
  inflight ??= fetch('/api/features')
    .then((r) => (r.ok ? r.json() : { features: {}, is_master: false }))
    .then((d) => ({ flags: (d.features ?? {}) as FeatureFlags, isMaster: !!d.is_master }))
    .catch(() => ({ flags: {}, isMaster: false }))
  return inflight
}

/** Call after saving so the nav re-reads the flags. */
export function resetFeatureFlagsCache() {
  inflight = null
}

export function useFeatureFlags(): State {
  const [state, setState] = useState<State>({ flags: {}, isMaster: false })
  useEffect(() => {
    let alive = true
    fetchFlags().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [])
  return state
}
