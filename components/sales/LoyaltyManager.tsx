'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Customer {
  id: string
  name: string
}

interface LedgerEntry {
  id: string
  points_change: number
  reason: string
  created_at: string
}

export function LoyaltyManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [settings, setSettings] = useState({ loyalty_points_per_1000: 1, loyalty_rp_per_point: 100 })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [balance, setBalance] = useState(0)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ points: '', reason: '' })
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    const [settingsRes, customersRes] = await Promise.all([
      fetch(`/api/loyalty/settings?outlet_id=${outletId}`),
      fetch(`/api/customers?outlet_id=${outletId}`),
    ])
    const settingsData = await settingsRes.json()
    const customersData = await customersRes.json()
    if (settingsRes.ok) setSettings(settingsData.settings)
    if (customersRes.ok) setCustomers(customersData.customers ?? [])
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const loadLedger = useCallback(async () => {
    if (!selectedCustomer) {
      setLedger([])
      setBalance(0)
      return
    }
    const res = await fetch(`/api/customers/${selectedCustomer}/loyalty`)
    const data = await res.json()
    if (res.ok) {
      setLedger(data.ledger ?? [])
      setBalance(data.balance ?? 0)
    }
  }, [selectedCustomer])

  useEffect(() => {
    const timeout = setTimeout(loadLedger, 0)
    return () => clearTimeout(timeout)
  }, [loadLedger])

  async function saveSettings() {
    setIsSavingSettings(true)
    try {
      const res = await fetch(`/api/loyalty/settings?outlet_id=${outletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) showToast('Pengaturan loyalty disimpan', 'success')
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function adjust(sign: 1 | -1) {
    if (!selectedCustomer) return
    setError(null)
    setIsAdjusting(true)
    try {
      const res = await fetch('/api/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer,
          points_change: sign * Math.abs(Number(adjustForm.points) || 0),
          reason: adjustForm.reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan poin')
        return
      }
      showToast(sign === 1 ? 'Poin ditambahkan' : 'Poin ditukar', 'success')
      setAdjustForm({ points: '', reason: '' })
      loadLedger()
    } finally {
      setIsAdjusting(false)
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Pengaturan Poin</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Poin per Rp1.000 belanja"
              type="number"
              min="0"
              value={settings.loyalty_points_per_1000}
              onChange={(e) => setSettings((s) => ({ ...s, loyalty_points_per_1000: Number(e.target.value) }))}
            />
            <Input
              label="Nilai tukar 1 poin (Rp)"
              type="number"
              min="1"
              value={settings.loyalty_rp_per_point}
              onChange={(e) => setSettings((s) => ({ ...s, loyalty_rp_per_point: Number(e.target.value) }))}
            />
            <div className="flex items-end">
              <Button onClick={saveSettings} isLoading={isSavingSettings}>
                Simpan
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Poin Pelanggan</h2>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Pilih Pelanggan</label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-1/2"
          >
            <option value="">Pilih pelanggan…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCustomer && (
          <div className="mt-4 space-y-4">
            <p className="text-lg font-bold text-gray-900">Saldo: {balance} poin</p>

            {error && <Alert variant="danger">{error}</Alert>}

            <div className="flex flex-wrap items-end gap-3">
              <Input label="Jumlah Poin" type="number" min="1" value={adjustForm.points} onChange={(e) => setAdjustForm((f) => ({ ...f, points: e.target.value }))} />
              <Input label="Alasan" value={adjustForm.reason} onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Belanja Rp150.000 / Tukar diskon" />
              <Button onClick={() => adjust(1)} isLoading={isAdjusting} size="sm">
                + Beri Poin
              </Button>
              <Button onClick={() => adjust(-1)} isLoading={isAdjusting} size="sm" variant="secondary">
                - Tukar Poin
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada riwayat poin</td>
                    </tr>
                  ) : (
                    ledger.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 text-gray-600">{formatDateTime(l.created_at)}</td>
                        <td className="px-4 py-2 text-gray-700">{l.reason}</td>
                        <td className={`px-4 py-2 text-right font-medium ${l.points_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {l.points_change > 0 ? `+${l.points_change}` : l.points_change}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
