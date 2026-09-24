'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Row {
  account_id: string
  account_code: string
  account_name: string
  account_type: 'income' | 'expense'
  budget: number
  actual: number
  variance: number
  pct: number | null
  status: 'ok' | 'warn' | 'bad' | 'none'
}

const STATUS_CLASS = { ok: 'text-emerald-600', warn: 'text-amber-600', bad: 'font-semibold text-red-600', none: 'text-gray-400' }

export function BudgetManager({ canManage }: { canManage: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!outletId) return
    const res = await fetch(`/api/accounting/budgets?outlet_id=${outletId}&month=${month}`)
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Gagal memuat anggaran')
      return
    }
    setError(null)
    setRows(data.rows ?? [])
    setDraft({})
  }, [outletId, month])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function save() {
    const items = Object.entries(draft).map(([account_id, v]) => ({ account_id, amount: Number(v || 0) }))
    if (items.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/accounting/budgets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: outletId, month, items }) })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan')
        return
      }
      showToast('Anggaran disimpan', 'success')
      load()
    } finally {
      setSaving(false)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const section = (type: 'income' | 'expense', title: string) => {
    const list = rows.filter((r) => r.account_type === type)
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">{title}</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Anggaran</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Realisasi</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-600">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {list.map((r) => (
              <tr key={r.account_id}>
                <td className="px-3 py-2 text-gray-900">{r.account_code} · {r.account_name}</td>
                <td className="px-3 py-2 text-right">
                  {canManage ? (
                    <input
                      type="number"
                      min="0"
                      aria-label={`Anggaran ${r.account_name}`}
                      className="w-32 rounded-sm border border-gray-200 px-2 py-1 text-right text-sm"
                      value={draft[r.account_id] ?? String(r.budget)}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.account_id]: e.target.value }))}
                    />
                  ) : (
                    formatCurrency(r.budget)
                  )}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.actual)}</td>
                <td className={`px-3 py-2 text-right ${STATUS_CLASS[r.status]}`}>
                  {formatCurrency(r.variance)}
                  {r.pct !== null && <span className="ml-1 text-xs">({(r.pct * 100).toFixed(0)}%)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <Input name="budget_month" label="Bulan" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {canManage && <Button onClick={save} isLoading={saving} disabled={Object.keys(draft).length === 0}>Simpan Anggaran</Button>}
        <ExportCsvButton filename={`anggaran-${month}`} rows={rows.map((r) => ({ Akun: `${r.account_code} ${r.account_name}`, Tipe: r.account_type, Anggaran: r.budget, Realisasi: r.actual, Selisih: r.variance }))} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {section('income', 'Pendapatan')}
      {section('expense', 'Beban')}
    </div>
  )
}
