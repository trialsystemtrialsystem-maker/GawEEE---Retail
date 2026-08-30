'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface Account {
  id: string
  account_code: string
  account_name: string
  account_type: string
}

const TYPE_LABEL: Record<string, string> = {
  asset: 'Aset',
  liability: 'Liabilitas',
  equity: 'Ekuitas',
  income: 'Pendapatan',
  expense: 'Beban',
}

const TYPE_COLOR: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-amber-50 text-amber-700',
  equity: 'bg-violet-50 text-violet-700',
  income: 'bg-emerald-50 text-emerald-700',
  expense: 'bg-red-50 text-red-700',
}

export function ChartOfAccountsList({ outletId }: { outletId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ account_code: '', account_name: '', account_type: 'expense' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/accounting/accounts?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setAccounts(data.accounts ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah akun')
        return
      }
      showToast(`Akun "${form.account_name}" berhasil ditambahkan`, 'success')
      setForm({ account_code: '', account_name: '', account_type: 'expense' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{accounts.length} akun aktif</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Akun'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input
            label="Kode Akun"
            required
            placeholder="6000"
            value={form.account_code}
            onChange={(e) => setForm((f) => ({ ...f, account_code: e.target.value }))}
          />
          <Input
            label="Nama Akun"
            required
            value={form.account_name}
            onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipe</label>
            <select
              value={form.account_type}
              onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kode</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Akun</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tipe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada akun</td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-700">{a.account_code}</td>
                  <td className="px-4 py-2 text-gray-900">{a.account_name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[a.account_type]}`}>
                      {TYPE_LABEL[a.account_type] ?? a.account_type}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
