'use client'

import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { formatCurrency } from '@/lib/utils/formatting'
import { parseStockCsv } from '@/lib/utils/stockCsv'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'
import { useNotificationStore } from '@/store/notificationStore'

interface Result {
  sku: string
  name: string | null
  before: number
  after: number
  delta: number
  status: 'ok' | 'unchanged' | 'unknown_sku' | 'invalid'
  message?: string
}
interface Summary {
  ok: number
  unchanged: number
  problems: number
  value_change: number
}

const STATUS_LABEL = { ok: 'Diubah', unchanged: 'Tetap', unknown_sku: 'SKU tidak ada', invalid: 'Tidak valid' }

export function StockImport() {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'set' | 'add'>('set')
  const [reason, setReason] = useState('Saldo awal stok')
  const [parseErrors, setParseErrors] = useState<{ line: number; message: string }[]>([])
  const [preview, setPreview] = useState<{ results: Result[]; summary: Summary } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  async function run(dry: boolean) {
    setError(null)
    const parsed = parseStockCsv(text)
    setParseErrors(parsed.errors)
    if (parsed.rows.length === 0) {
      setPreview(null)
      return setError('Tidak ada baris valid. Tempel data dengan kolom SKU dan jumlah.')
    }
    setBusy(true)
    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, mode, reason, dry_run: dry, rows: parsed.rows.map((r) => ({ sku: r.sku, quantity: r.quantity })) }),
      })
      const data = await res.json()
      if (data.results) setPreview({ results: data.results, summary: data.summary })
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      if (!dry) {
        showToast(`${data.summary.ok} produk diperbarui`, 'success')
        setText('')
        setPreview(null)
      }
    } finally {
      setBusy(false)
    }
  }

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const canApply = preview && preview.summary.problems === 0 && preview.summary.ok > 0 && parseErrors.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
        <div className="space-y-1">
          <label htmlFor="imp_mode" className="block text-sm font-medium text-gray-700">Isi file berarti</label>
          <select id="imp_mode" value={mode} onChange={(e) => setMode(e.target.value as 'set' | 'add')} className="rounded-sm border border-gray-200 px-3 py-2 text-sm">
            <option value="set">Stok sebenarnya (menimpa)</option>
            <option value="add">Tambah/kurang dari stok sekarang</option>
          </select>
        </div>
        <Input name="imp_reason" label="Alasan" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <Card className="space-y-2">
        <label htmlFor="imp_text" className="block text-sm font-medium text-gray-700">Tempel dari Excel/Sheets atau CSV (kolom: SKU, jumlah)</label>
        <textarea
          id="imp_text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'sku,qty\nDEMO-001,120\nDEMO-002,45'}
          className="w-full rounded-sm border border-gray-200 px-3 py-2 font-mono text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            aria-label="Unggah file CSV"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setText(await f.text())
            }}
            className="text-sm"
          />
          <Button variant="secondary" onClick={() => run(true)} isLoading={busy}>Periksa (tanpa menyimpan)</Button>
          <Button onClick={() => run(false)} isLoading={busy} disabled={!canApply}>Terapkan Impor</Button>
        </div>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {parseErrors.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc pl-5">
            {parseErrors.slice(0, 10).map((e) => (
              <li key={e.line}>Baris {e.line}: {e.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {preview.summary.ok} berubah · {preview.summary.unchanged} tetap · {preview.summary.problems} bermasalah · perubahan nilai persediaan{' '}
            <strong>{formatCurrency(preview.summary.value_change)}</strong>
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Sebelum</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Sesudah</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Selisih</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {preview.results.map((r) => (
                  <tr key={r.sku}>
                    <td className="px-3 py-2 text-gray-700">{r.sku}</td>
                    <td className="px-3 py-2 text-gray-900">{r.name ?? '-'}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.before}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{r.after}</td>
                    <td className={`px-3 py-2 text-right ${r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                    <td className={`px-3 py-2 ${r.status === 'unknown_sku' || r.status === 'invalid' ? 'text-red-600' : 'text-gray-600'}`}>{r.message ?? STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
