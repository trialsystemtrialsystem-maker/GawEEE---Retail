'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Advance {
  id: string
  amount: number
  advance_date: string
  reason: string
  repay_per_period: number
  status: 'pending' | 'approved' | 'rejected' | 'paid_out' | 'repaid'
  repaid: number
  outstanding: number
  decided_at: string | null
  paid_out_at: string | null
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Disetujui (belum dicairkan)', className: 'bg-brand-50 text-brand-700' },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700' },
  paid_out: { label: 'Dicairkan — berjalan', className: 'bg-violet-50 text-violet-700' },
  repaid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700' },
}

export function KasbonPanel({ staffId, outletId, canManage }: { staffId: string; outletId: string; canManage: boolean }) {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', reason: '', repay_per_period: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [repayFor, setRepayFor] = useState<{ id: string; amount: string } | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/cash-advances?outlet_id=${outletId}&staff_id=${staffId}`)
    const data = await res.json()
    if (res.ok) setAdvances(data.advances ?? [])
    else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat kasbon')
    setIsLoading(false)
  }, [outletId, staffId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/cash-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          amount: Number(form.amount),
          reason: form.reason,
          repay_per_period: form.repay_per_period ? Number(form.repay_per_period) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast('Pengajuan kasbon dibuat', 'success')
      setForm({ amount: '', reason: '', repay_per_period: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function act(id: string, body: Record<string, unknown>, okMessage: string) {
    const res = await fetch(`/api/cash-advances/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) {
      showToast(typeof data.error === 'string' ? data.error : 'Gagal memproses', 'danger')
      return
    }
    showToast(okMessage, 'success')
    setRepayFor(null)
    load()
  }

  const outstanding = advances.reduce((s, a) => s + a.outstanding, 0)
  const totalPaidOut = advances.filter((a) => a.status === 'paid_out' || a.status === 'repaid').reduce((s, a) => s + a.amount, 0)
  const csvRows = advances.map((a) => ({
    Tanggal: a.advance_date,
    Nominal: a.amount,
    Alasan: a.reason,
    'Cicilan per Periode': a.repay_per_period,
    Status: STATUS[a.status]?.label ?? a.status,
    'Sudah Dibayar': a.repaid,
    Sisa: a.outstanding,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Sisa Kasbon Berjalan</p>
          <p className={`mt-1 text-xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(outstanding)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Pernah Dicairkan</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(totalPaidOut)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Jumlah Pengajuan</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{advances.length}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Ajukan Kasbon'}
        </Button>
        <ExportCsvButton filename="kasbon-karyawan" rows={csvRows} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input name="kasbon_amount" label="Nominal (Rp)" type="number" min="1" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input
            name="kasbon_repay"
            label="Cicilan per Gajian (Rp, kosong = lunas sekaligus)"
            type="number"
            min="0"
            value={form.repay_per_period}
            onChange={(e) => setForm((f) => ({ ...f, repay_per_period: e.target.value }))}
          />
          <Input name="kasbon_reason" label="Alasan" required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Kirim Pengajuan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Nominal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Cicilan/Periode</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Sudah Dibayar</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Sisa</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              {canManage && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : advances.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">Belum ada riwayat kasbon</td>
              </tr>
            ) : (
              advances.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{formatDate(a.advance_date)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(a.amount)}</td>
                  <td className="px-4 py-2 text-gray-700">{a.reason}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{a.repay_per_period ? formatCurrency(a.repay_per_period) : 'Sekaligus'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(a.repaid)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(a.outstanding)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[a.status]?.className ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span>
                  </td>
                  {canManage && (
                    <td className="space-x-2 px-4 py-2 whitespace-nowrap">
                      {a.status === 'pending' && (
                        <>
                          <button className="text-emerald-600 hover:underline" onClick={() => act(a.id, { action: 'approve' }, 'Kasbon disetujui')}>Setujui</button>
                          <button className="text-red-600 hover:underline" onClick={() => act(a.id, { action: 'reject' }, 'Kasbon ditolak')}>Tolak</button>
                        </>
                      )}
                      {a.status === 'approved' && (
                        <button className="text-brand-600 hover:underline" onClick={() => act(a.id, { action: 'payout' }, 'Kasbon dicairkan')}>Cairkan</button>
                      )}
                      {a.status === 'paid_out' &&
                        (repayFor?.id === a.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              aria-label="Nominal cicilan manual"
                              className="w-28 rounded-sm border border-gray-200 px-2 py-1 text-sm"
                              value={repayFor.amount}
                              onChange={(e) => setRepayFor({ id: a.id, amount: e.target.value })}
                            />
                            <button className="text-brand-600 hover:underline" onClick={() => act(a.id, { action: 'repay', amount: Number(repayFor.amount) }, 'Cicilan dicatat')}>Simpan</button>
                          </span>
                        ) : (
                          <button className="text-brand-600 hover:underline" onClick={() => setRepayFor({ id: a.id, amount: '' })}>Catat Cicilan</button>
                        ))}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
