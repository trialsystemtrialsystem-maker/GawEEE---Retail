'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { OutletSelector } from '@/components/ui/OutletSelector'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency } from '@/lib/utils/formatting'
import { useResolvedOutlet } from '@/lib/hooks/useResolvedOutlet'

interface AccountRow {
  id: string
  account_code: string
  account_name: string
  account_type: string
  debit: number
  credit: number
}

interface TrialBalanceData {
  accounts: AccountRow[]
  total_debit: number
  total_credit: number
  is_balanced: boolean
}

const TYPE_LABEL: Record<string, string> = {
  asset: 'Aset',
  liability: 'Liabilitas',
  equity: 'Ekuitas',
  income: 'Pendapatan',
  expense: 'Beban',
}

export function TrialBalanceView({ outletId: outletIdProp }: { outletId?: string }) {
  const { outletId, isResolving, selectedOutlet, setSelectedOutlet } = useResolvedOutlet(outletIdProp)
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<TrialBalanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!outletId) return
    setIsLoading(true)
    const res = await fetch(`/api/accounting/reports?outlet_id=${outletId}&type=trial-balance&as_of=${asOf}`)
    const json = await res.json()
    if (res.ok) setData(json)
    setIsLoading(false)
  }, [outletId, asOf])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  if (isResolving) return <p className="text-sm text-gray-400">Memuat…</p>

  const csvRows = (data?.accounts ?? []).map((a) => ({
    kode: a.account_code,
    nama_akun: a.account_name,
    tipe: TYPE_LABEL[a.account_type] ?? a.account_type,
    debit: a.debit,
    kredit: a.credit,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {!outletIdProp && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Outlet</label>
              <OutletSelector includeAll={false} value={selectedOutlet} onChange={setSelectedOutlet} />
            </div>
          )}
          <Input name="as_of" label="Per Tanggal" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <ExportCsvButton filename="neraca-saldo" rows={csvRows} />
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : (
        <>
          <Alert variant={data.is_balanced ? 'success' : 'danger'}>
            {data.is_balanced
              ? 'Total Debit dan Kredit seimbang — pembukuan konsisten.'
              : `Total Debit (${formatCurrency(data.total_debit)}) tidak sama dengan Total Kredit (${formatCurrency(data.total_credit)}) — periksa jurnal yang belum seimbang.`}
          </Alert>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Kode</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Akun</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Tipe</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Debit</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada akun dengan saldo</td>
                  </tr>
                ) : (
                  data.accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-700">{a.account_code}</td>
                      <td className="px-4 py-2 text-gray-900">{a.account_name}</td>
                      <td className="px-4 py-2 text-gray-500">{TYPE_LABEL[a.account_type] ?? a.account_type}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{a.debit > 0 ? formatCurrency(a.debit) : '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{a.credit > 0 ? formatCurrency(a.credit) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(data.total_debit)}</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(data.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
