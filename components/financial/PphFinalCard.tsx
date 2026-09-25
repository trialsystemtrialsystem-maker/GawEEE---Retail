'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Month {
  month: string
  gross_turnover: number
  cumulative_turnover: number
  taxable_turnover: number
  tax_due: number
}
interface Data {
  year: string
  settings: { enabled: boolean; rate_percent: number; threshold: number }
  months: Month[]
  totals: { gross_turnover: number; taxable_turnover: number; tax_due: number }
}

export function PphFinalCard({ isMaster }: { isMaster: boolean }) {
  const [outletId, setOutletId] = useState('all')
  const [year, setYear] = useState(() => new Date().toISOString().slice(0, 4))
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ enabled: true, rate_percent: '0.5', regime: 'pribadi' })
  const [saving, setSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/reports/pph-final?year=${year}&outlet_id=${outletId}`)
    const json = await res.json()
    if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Gagal memuat PPh Final')
    setData(json)
  }, [year, outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tax-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: form.enabled, rate_percent: Number(form.rate_percent), threshold: form.regime === 'pribadi' ? 500_000_000 : 0 }),
      })
      const json = await res.json()
      if (!res.ok) return setError(typeof json.error === 'string' ? json.error : 'Periksa kembali isian')
      showToast('Pengaturan PPh Final disimpan', 'success')
      setEditing(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const th = 'px-3 py-2 font-semibold text-gray-600'
  const s = data?.settings

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">PPh Final UMKM</h2>
          <p className="text-sm text-gray-500">
            {s ? (s.enabled ? `${s.rate_percent}% dari omzet bruto per bulan${s.threshold > 0 ? `, omzet ${formatCurrency(s.threshold)} pertama per tahun tidak dikenai pajak` : ', tanpa batas omzet tidak kena pajak (badan usaha)'}` : 'Dinonaktifkan') : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OutletSelector value={outletId} onChange={setOutletId} />
          <select aria-label="Tahun pajak" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-sm border border-gray-200 px-2 py-1.5 text-sm">
            {Array.from({ length: 5 }, (_, i) => String(new Date().getUTCFullYear() - i)).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {data && <ExportCsvButton filename={`pph-final-${year}`} rows={data.months.map((m) => ({ Bulan: m.month, 'Omzet Bruto': m.gross_turnover, Kumulatif: m.cumulative_turnover, 'Dikenai Pajak': m.taxable_turnover, 'PPh Terutang': m.tax_due }))} />}
          {isMaster && !editing && s && (
            <Button size="sm" variant="secondary" onClick={() => { setForm({ enabled: s.enabled, rate_percent: String(s.rate_percent), regime: s.threshold > 0 ? 'pribadi' : 'badan' }); setEditing(true) }}>
              Atur
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {editing && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Hitung PPh Final</label>
          <Input name="pph_rate" label="Tarif (%)" type="number" min="0" max="100" step="0.1" value={form.rate_percent} onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))} />
          <div className="space-y-1">
            <label htmlFor="pph_regime" className="block text-sm font-medium text-gray-700">Jenis wajib pajak</label>
            <select id="pph_regime" value={form.regime} onChange={(e) => setForm((f) => ({ ...f, regime: e.target.value }))} className="rounded-sm border border-gray-200 px-3 py-2 text-sm">
              <option value="pribadi">Orang pribadi (omzet Rp 500 juta pertama bebas)</option>
              <option value="badan">Badan usaha CV/PT (tanpa batas bebas)</option>
            </select>
          </div>
          <Button type="submit" isLoading={saving}>Simpan</Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Batal</Button>
        </form>
      )}

      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Bulan</th>
                <th className={`${th} text-right`}>Omzet Bruto</th>
                <th className={`${th} text-right`}>Kumulatif</th>
                <th className={`${th} text-right`}>Dikenai Pajak</th>
                <th className={`${th} text-right`}>PPh Terutang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.months.map((m) => (
                <tr key={m.month}>
                  <td className="px-3 py-2 text-gray-900">{m.month}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(m.gross_turnover)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(m.cumulative_turnover)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(m.taxable_turnover)}</td>
                  <td className={`px-3 py-2 text-right ${m.tax_due > 0 ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{formatCurrency(m.tax_due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Total {data.year}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.totals.gross_turnover)}</td>
                <td />
                <td className="px-3 py-2 text-right">{formatCurrency(data.totals.taxable_turnover)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.totals.tax_due)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">Perkiraan untuk membantu perencanaan pembayaran/pelaporan; konfirmasikan angka final dengan konsultan pajak Anda. Omzet dihitung dari penjualan tidak dibatalkan, sebelum PPN, dan belum dikurangi refund.</p>
    </Card>
  )
}
