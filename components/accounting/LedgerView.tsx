'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

interface Account {
  id: string
  account_code: string
  account_name: string
}

interface LedgerRow {
  entry_id: string
  entry_date: string
  description: string
  debit: number
  credit: number
  balance: number
}

export function LedgerView({ outletId }: { outletId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [endingBalance, setEndingBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const loadAccounts = useCallback(async () => {
    const res = await fetch(`/api/accounting/accounts?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) {
      setAccounts(data.accounts ?? [])
      if (data.accounts?.length) setAccountId(data.accounts[0].id)
    }
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(loadAccounts, 0)
    return () => clearTimeout(timeout)
  }, [loadAccounts])

  const loadLedger = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    const res = await fetch(`/api/accounting/ledger?outlet_id=${outletId}&account_id=${accountId}`)
    const data = await res.json()
    if (res.ok) {
      setRows(data.rows ?? [])
      setEndingBalance(data.ending_balance ?? 0)
    }
    setIsLoading(false)
  }, [outletId, accountId])

  useEffect(() => {
    const timeout = setTimeout(loadLedger, 0)
    return () => clearTimeout(timeout)
  }, [loadLedger])

  return (
    <div className="space-y-4">
      <div className="max-w-md space-y-1">
        <label className="block text-sm font-medium text-gray-700">Pilih Akun</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_code} - {a.account_name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Debit</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kredit</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada transaksi terposting untuk akun ini</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{formatDate(r.entry_date)}</td>
                  <td className="px-4 py-2 text-gray-900">{r.description}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-right font-semibold text-gray-700">Saldo Akhir</td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">{formatCurrency(endingBalance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
