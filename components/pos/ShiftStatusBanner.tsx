'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

// Soft banner only — does NOT block transacting if no shift is open (see
// Phase 11 plan: hard-gating checkout on shift state risks locking cashiers
// out and wasn't worth the risk to the already-E2E-tested checkout flow for
// a v1). Just makes it easy to open one and visible when it's missing.
export function ShiftStatusBanner({ outletId }: { outletId: string }) {
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const res = await fetch(`/api/cashier-shifts?outlet_id=${outletId}&status=open`)
    const data = await res.json()
    if (res.ok) setHasOpenShift((data.shifts ?? []).length > 0)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/cashier-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, opening_cash: Number(openingCash) || 0 }),
      })
      if (res.ok) {
        showToast('Shift kasir dibuka', 'success')
        setShowForm(false)
        setOpeningCash('')
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (hasOpenShift === null || hasOpenShift) return null

  return (
    <div className="mb-3 rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm">
      {!showForm ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-amber-800">Shift kasir belum dibuka.</span>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(true)} className="font-medium text-amber-900 underline">
              Buka Kasir
            </button>
            <Link href="/dashboard/staff/cashier-shifts" className="font-medium text-amber-900 underline">
              Riwayat
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleOpen} className="flex flex-wrap items-end gap-2">
          <Input label="Kas Awal (Rp)" type="number" min="0" required value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            Buka
          </Button>
        </form>
      )}
    </div>
  )
}
