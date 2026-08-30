'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Account {
  id: string
  account_code: string
  account_name: string
}

interface JournalEntry {
  id: string
  entry_date: string
  description: string
  status: string
}

interface Line {
  account_id: string
  debit: string
  credit: string
}

const emptyLine = (): Line => ({ account_id: '', debit: '', credit: '' })

export function JournalEntryManager({ outletId, canPost }: { outletId: string; canPost: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postingId, setPostingId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [accountsRes, entriesRes] = await Promise.all([
      fetch(`/api/accounting/accounts?outlet_id=${outletId}`),
      fetch(`/api/accounting/journal-entries?outlet_id=${outletId}`),
    ])
    const accountsData = await accountsRes.json()
    const entriesData = await entriesRes.json()
    if (accountsRes.ok) setAccounts(accountsData.accounts ?? [])
    if (entriesRes.ok) setEntries(entriesData.entries ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isBalanced) {
      setError('Total debit dan kredit harus sama dan lebih dari 0')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/accounting/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          entry_date: entryDate,
          description,
          lines: lines
            .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
            .map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan jurnal')
        return
      }
      showToast('Jurnal draft berhasil disimpan', 'success')
      setDescription('')
      setLines([emptyLine(), emptyLine()])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePost(id: string) {
    setPostingId(id)
    try {
      const res = await fetch(`/api/accounting/journal-entries/${id}/post`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal memposting jurnal', 'danger')
        return
      }
      showToast('Jurnal berhasil diposting', 'success')
      load()
    } finally {
      setPostingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{entries.length} entri jurnal</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={accounts.length === 0}>
          {showForm ? 'Batal' : '+ Buat Jurnal'}
        </Button>
      </div>

      {accounts.length === 0 && !isLoading && (
        <Alert variant="warning">Belum ada akun. Tambahkan akun di Chart of Accounts terlebih dahulu.</Alert>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tanggal"
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
            <Input
              label="Deskripsi"
              required
              placeholder="Contoh: Bayar sewa toko bulan Agustus"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
                <select
                  required
                  value={line.account_id}
                  onChange={(e) => updateLine(i, { account_id: e.target.value })}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih akun…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code} - {a.account_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="Debit"
                  value={line.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: '' })}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Kredit"
                  value={line.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: '' })}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {lines.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Hapus
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Tambah baris
            </button>
            <p className={`text-sm font-medium ${isBalanced ? 'text-emerald-600' : 'text-gray-500'}`}>
              Debit {formatCurrency(totalDebit)} · Kredit {formatCurrency(totalCredit)}
              {isBalanced ? ' ✓ Seimbang' : ''}
            </p>
          </div>

          <Button type="submit" isLoading={isSubmitting} disabled={!isBalanced}>
            Simpan Draft
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada jurnal</td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{formatDate(e.entry_date)}</td>
                  <td className="px-4 py-2 text-gray-900">{e.description}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {e.status === 'posted' ? 'Posted' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {e.status === 'draft' && canPost && (
                      <button
                        onClick={() => handlePost(e.id)}
                        disabled={postingId === e.id}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        {postingId === e.id ? 'Memposting…' : 'Post'}
                      </button>
                    )}
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
