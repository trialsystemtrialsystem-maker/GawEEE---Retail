'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { useNotificationStore } from '@/store/notificationStore'

// 'card' isn't offered here — the POS payment screen doesn't have a card
// flow built (see components/pos/PaymentMethod.tsx), so it's left out to
// avoid a toggle that wouldn't actually change anything at checkout.
const ALL_METHODS = ['cash', 'e_wallet', 'bank_transfer']

export function PaymentMethodsSettings({
  outletId,
  initialEnabled,
  canManage,
}: {
  outletId: string
  initialEnabled: string[]
  canManage: boolean
}) {
  const [enabled, setEnabled] = useState(new Set(initialEnabled))
  const [isSaving, setIsSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  function toggle(method: string) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(method)) next.delete(method)
      else next.add(method)
      return next
    })
  }

  async function save() {
    if (enabled.size === 0) {
      showToast('Minimal satu metode pembayaran harus aktif', 'danger')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/outlets/${outletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_payment_methods: Array.from(enabled) }),
      })
      if (res.ok) showToast('Metode pembayaran berhasil disimpan', 'success')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      {!canManage && <Alert variant="info">Hanya Manajer Outlet/Master Admin yang dapat mengubah pengaturan ini.</Alert>}
      <p className="mb-4 text-sm text-gray-500">Pilih metode pembayaran yang tersedia di kasir (POS) outlet ini.</p>
      <div className="space-y-2">
        {ALL_METHODS.map((method) => (
          <label key={method} className="flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3">
            <input
              type="checkbox"
              checked={enabled.has(method)}
              disabled={!canManage}
              onChange={() => toggle(method)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-gray-900">{PAYMENT_METHOD_LABELS[method]}</span>
          </label>
        ))}
      </div>
      {canManage && (
        <div className="mt-4">
          <Button onClick={save} isLoading={isSaving}>
            Simpan
          </Button>
        </div>
      )}
    </Card>
  )
}
