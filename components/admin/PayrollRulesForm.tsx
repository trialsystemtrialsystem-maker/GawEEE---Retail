'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Rules {
  late_penalty_per_minute: number
  overtime_per_hour: number
  absence_deduction_per_day: number
  allowances: { label: string; amount: number }[]
  percent_deductions: { label: string; percent: number }[]
  leave_days_per_year: number
}

export function PayrollRulesForm() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch('/api/admin/payroll-rules')
      const data = await res.json()
      if (res.ok) setRules(data)
      else setError(typeof data.error === 'string' ? data.error : 'Gagal memuat aturan')
    }, 0)
    return () => clearTimeout(t)
  }, [])

  if (error && !rules) return <Alert variant="danger">{error}</Alert>
  if (!rules) return <p className="text-gray-400">Memuat…</p>

  const set = (patch: Partial<Rules>) => setRules((r) => (r ? { ...r, ...patch } : r))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payroll-rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rules) })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast('Aturan penggajian disimpan', 'success')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info">Berlaku pada payroll run berikutnya. Nilai 0 berarti aturan tidak dipakai. Payroll yang sudah dibuat tidak berubah.</Alert>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Kehadiran</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="late" label="Potongan terlambat (Rp / menit)" type="number" min="0" value={rules.late_penalty_per_minute} onChange={(e) => set({ late_penalty_per_minute: Number(e.target.value) })} />
          <Input name="absence" label="Potongan absen (Rp / hari)" type="number" min="0" value={rules.absence_deduction_per_day} onChange={(e) => set({ absence_deduction_per_day: Number(e.target.value) })} />
          <Input name="overtime" label="Upah lembur (Rp / jam)" type="number" min="0" value={rules.overtime_per_hour} onChange={(e) => set({ overtime_per_hour: Number(e.target.value) })} />
        </div>
        <Input name="leave" label="Jatah cuti tahunan (hari)" type="number" min="0" value={rules.leave_days_per_year} onChange={(e) => set({ leave_days_per_year: Number(e.target.value) })} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Tunjangan tetap (semua karyawan)</h2>
        {rules.allowances.map((a, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Input name={`al-${i}`} label="Nama" value={a.label} onChange={(e) => set({ allowances: rules.allowances.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input name={`aa-${i}`} label="Nominal (Rp)" type="number" min="0" value={a.amount} onChange={(e) => set({ allowances: rules.allowances.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)) })} />
            <Button type="button" variant="secondary" size="sm" onClick={() => set({ allowances: rules.allowances.filter((_, j) => j !== i) })}>Hapus</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => set({ allowances: [...rules.allowances, { label: '', amount: 0 }] })}>+ Tunjangan</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Potongan persentase (BPJS, PPh 21, dll.)</h2>
        <p className="text-sm text-gray-500">Dihitung dari gaji pokok dan dicatat sebagai utang yang harus disetor (akun 2100).</p>
        {rules.percent_deductions.map((d, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Input name={`dl-${i}`} label="Nama" value={d.label} onChange={(e) => set({ percent_deductions: rules.percent_deductions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input name={`dp-${i}`} label="Persen (%)" type="number" min="0" max="100" step="0.01" value={d.percent} onChange={(e) => set({ percent_deductions: rules.percent_deductions.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) } : x)) })} />
            <Button type="button" variant="secondary" size="sm" onClick={() => set({ percent_deductions: rules.percent_deductions.filter((_, j) => j !== i) })}>Hapus</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => set({ percent_deductions: [...rules.percent_deductions, { label: '', percent: 0 }] })}>+ Potongan</Button>
      </Card>

      <Button type="submit" isLoading={saving}>Simpan Aturan</Button>
    </form>
  )
}
