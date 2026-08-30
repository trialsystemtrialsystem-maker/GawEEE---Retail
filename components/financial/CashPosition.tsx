'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/dashboard/KPICard'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDateTime } from '@/lib/utils/formatting'

interface CashPositionData {
  as_of: string
  cash_on_hand: number
  pending_e_wallet_settlement: number
  pending_bank_transfer: number
  total_available_cash: number
  recent_transactions: { type: string; amount: number; timestamp: string }[]
}

export function CashPosition() {
  const [data, setData] = useState<CashPositionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports/cash-position')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Gagal memuat data')
          return
        }
        setData(json)
      })
      .catch(() => setError('Terjadi kesalahan jaringan'))
  }, [])

  if (error) return <Alert variant="danger">{error}</Alert>
  if (!data) return <p className="text-gray-400">Memuat…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard label="Kas di Tangan" value={formatCurrency(data.cash_on_hand)} />
        <KPICard label="E-Wallet Pending" value={formatCurrency(data.pending_e_wallet_settlement)} />
        <KPICard label="Transfer Bank Pending" value={formatCurrency(data.pending_bank_transfer)} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Transaksi Kas Terakhir</h2>
        {data.recent_transactions.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada transaksi tunai.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {data.recent_transactions.map((t, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span className="capitalize text-gray-600">{t.type}</span>
                <span className="text-gray-900">{formatCurrency(t.amount)}</span>
                <span className="text-gray-400">{formatDateTime(t.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
