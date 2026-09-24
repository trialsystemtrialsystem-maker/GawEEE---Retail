'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface Rule {
  id: string
  name: string
  metric: 'sales_target' | 'transactions' | 'attendance_bonus'
  threshold: number
  amount: number
  is_active: boolean
}
interface Incentive {
  id: string
  staff_name: string
  rule_name: string
  amount: number
  source: 'auto' | 'manual'
  note: string | null
  basis: { threshold?: number; achieved?: number }
}

const METRIC_LABEL: Record<string, string> = {
  sales_target: 'Omzet harian ≥ target',
  transactions: 'Jumlah transaksi ≥ target',
  attendance_bonus: 'Hadir tepat waktu',
}

const today = () => new Date().toISOString().slice(0, 10)

export function IncentiveManager({ canManage }: { canManage: boolean }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [rules, setRules] = useState<Rule[]>([])
  const [incentives, setIncentives] = useState<Incentive[]>([])
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [form, setForm] = useState({ name: '', metric: 'sales_target', threshold: '', amount: '' })
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!outletId) return
    const [r, i] = await Promise.all([fetch(`/api/incentive-rules?outlet_id=${outletId}`), fetch(`/api/incentives?outlet_id=${outletId}&date=${date}`)])
    const rd = await r.json()
    const id = await i.json()
    if (r.ok) setRules(rd.rules ?? [])
    else setError(typeof rd.error === 'string' ? rd.error : 'Gagal memuat aturan')
    if (i.ok) setIncentives(id.incentives ?? [])
  }, [outletId, date])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/incentive-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlet_id: outletId, name: form.name, metric: form.metric, threshold: Number(form.threshold || 0), amount: Number(form.amount) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
      return
    }
    showToast('Aturan insentif ditambahkan', 'success')
    setForm({ name: '', metric: 'sales_target', threshold: '', amount: '' })
    load()
  }

  async function patchRule(id: string, body: Record<string, unknown>) {
    await fetch(`/api/incentive-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  async function deleteRule(id: string) {
    await fetch(`/api/incentive-rules/${id}`, { method: 'DELETE' })
    load()
  }

  async function calculate() {
    setIsCalculating(true)
    setError(null)
    try {
      const res = await fetch('/api/incentives/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet_id: outletId, date }) })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menghitung insentif')
        return
      }
      showToast(`${data.incentives_created} insentif dihitung untuk ${data.staff_evaluated} karyawan`, 'success')
      load()
    } finally {
      setIsCalculating(false)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const total = incentives.reduce((s, i) => s + i.amount, 0)
  const csvRows = incentives.map((i) => ({
    Tanggal: date,
    Karyawan: i.staff_name,
    Aturan: i.rule_name,
    Sumber: i.source === 'auto' ? 'Otomatis' : 'Manual',
    'Target': i.basis?.threshold ?? '',
    'Tercapai': i.basis?.achieved ?? '',
    Nominal: i.amount,
    Catatan: i.note ?? '',
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <Input name="incentive_date" label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {canManage && (
          <Button onClick={calculate} isLoading={isCalculating}>
            Hitung Insentif Hari Ini
          </Button>
        )}
        <ExportCsvButton filename={`insentif-${date}`} rows={csvRows} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Aturan Insentif</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Nama</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Syarat</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Target</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Insentif</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Aktif</th>
                {canManage && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-400">Belum ada aturan insentif</td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-gray-900">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{METRIC_LABEL[r.metric]}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.metric === 'sales_target' ? formatCurrency(r.threshold) : r.metric === 'transactions' ? r.threshold : '-'}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(r.amount)}</td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={r.is_active} disabled={!canManage} onChange={(e) => patchRule(r.id, { is_active: e.target.checked })} aria-label={`Aktifkan ${r.name}`} />
                    </td>
                    {canManage && (
                      <td className="px-3 py-2">
                        <button className="text-red-600 hover:underline" onClick={() => deleteRule(r.id)}>Hapus</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={addRule} className="grid grid-cols-1 items-end gap-3 border-t border-gray-100 pt-3 sm:grid-cols-5">
            <Input name="rule_name" label="Nama Aturan" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="rule_metric">Syarat</label>
              <select
                id="rule_metric"
                value={form.metric}
                onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm"
              >
                {Object.entries(METRIC_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <Input name="rule_threshold" label="Target" type="number" min="0" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} />
            <Input name="rule_amount" label="Insentif (Rp)" type="number" min="0" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <Button type="submit">Tambah Aturan</Button>
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Insentif {date} — total <span className="text-emerald-600">{formatCurrency(total)}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Karyawan</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Aturan</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Dasar Perhitungan</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {incentives.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400">Belum ada insentif pada tanggal ini — klik &quot;Hitung Insentif&quot;</td>
                </tr>
              ) : (
                incentives.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 text-gray-900">{i.staff_name}</td>
                    <td className="px-3 py-2 text-gray-700">{i.rule_name}{i.source === 'manual' && <span className="ml-1 text-xs text-gray-400">(manual)</span>}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {i.source === 'manual' ? (i.note ?? '-') : `tercapai ${i.basis?.achieved ?? '-'} dari target ${i.basis?.threshold ?? '-'}`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(i.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
