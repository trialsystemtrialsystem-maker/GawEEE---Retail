'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Run {
  id: string
  period_start: string
  period_end: string
  status: string
  created_at: string
}

interface Payslip {
  id: string
  base_salary: number
  commission_amount: number
  deductions: number
  net_pay: number
  staff_members: { first_name: string; last_name: string | null } | null
}

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function PayrollManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [period, setPeriod] = useState({ period_start: firstDayOfMonth(), period_end: new Date().toISOString().slice(0, 10) })
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/payroll/runs?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) {
      setRuns(data.runs ?? [])
      if (data.runs?.length && !selectedRun) setSelectedRun(data.runs[0].id)
    }
    setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const loadPayslips = useCallback(async () => {
    if (!selectedRun) {
      setPayslips([])
      return
    }
    const res = await fetch(`/api/payroll/runs/${selectedRun}`)
    const data = await res.json()
    if (res.ok) setPayslips(data.payslips ?? [])
  }, [selectedRun])

  useEffect(() => {
    const timeout = setTimeout(loadPayslips, 0)
    return () => clearTimeout(timeout)
  }, [loadPayslips])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...period, outlet_id: outletId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat payroll run')
        return
      }
      showToast('Payroll run berhasil dibuat', 'success')
      setShowForm(false)
      setSelectedRun(data.payroll_run_id)
      load()
    } finally {
      setIsGenerating(false)
    }
  }

  async function markPaid() {
    if (!selectedRun) return
    const res = await fetch(`/api/payroll/runs/${selectedRun}/pay`, { method: 'POST' })
    if (res.ok) {
      showToast('Payroll run ditandai sudah dibayar', 'success')
      load()
    }
  }

  const currentRun = runs.find((r) => r.id === selectedRun)
  const totalNet = payslips.reduce((s, p) => s + p.net_pay, 0)

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Payroll Run'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input
            label="Periode Mulai"
            type="date"
            required
            value={period.period_start}
            onChange={(e) => setPeriod((p) => ({ ...p, period_start: e.target.value }))}
          />
          <Input
            label="Periode Selesai"
            type="date"
            required
            value={period.period_end}
            onChange={(e) => setPeriod((p) => ({ ...p, period_end: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" isLoading={isGenerating}>
              Generate
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-1">
          <p className="text-sm font-semibold text-gray-700">Payroll Run</p>
          {isLoading ? (
            <p className="text-sm text-gray-400">Memuat…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada payroll run</p>
          ) : (
            <ul className="space-y-1">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedRun(r.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      selectedRun === r.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {formatDate(r.period_start)} - {formatDate(r.period_end)}
                    </p>
                    <p className="text-xs text-gray-500">{r.status === 'paid' ? 'Sudah dibayar' : 'Draft'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {currentRun ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Total: {formatCurrency(totalNet)}</p>
                {canManage && currentRun.status === 'draft' && (
                  <Button size="sm" variant="secondary" onClick={markPaid}>
                    Tandai Sudah Dibayar
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Gaji Pokok</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Komisi</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Potongan</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {payslips.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-gray-900">
                          {p.staff_members ? `${p.staff_members.first_name} ${p.staff_members.last_name ?? ''}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.base_salary)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.commission_amount)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(p.deductions)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(p.net_pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Pilih atau buat payroll run untuk melihat detail.</p>
          )}
        </div>
      </div>
    </div>
  )
}
