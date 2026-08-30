'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Staff {
  id: string
  first_name: string
  last_name: string | null
  position: string
  status: string
  employment_status: string | null
  salary_amount: number | null
  commission_rate: number
  phone: string | null
  email: string | null
  pin_code: string | null
}

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  position: '',
  hire_date: new Date().toISOString().slice(0, 10),
  salary_amount: '',
  employment_status: 'permanent',
  commission_rate: '0',
  pin_code: '',
}

export function StaffManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/staff?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setStaff(data.staff ?? [])
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
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          outlet_id: outletId,
          salary_amount: form.salary_amount ? Number(form.salary_amount) : undefined,
          commission_rate: Number(form.commission_rate) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah karyawan')
        return
      }
      showToast(`${form.first_name} berhasil ditambahkan`, 'success')
      setForm(emptyForm)
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleStatus(s: Staff) {
    const newStatus = s.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{staff.length} karyawan</p>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Tambah Karyawan'}
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input
            label="Nama Depan"
            required
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          />
          <Input
            label="Nama Belakang"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          />
          <Input
            label="Jabatan"
            required
            placeholder="Kasir, Supervisor, dll"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
          <Input
            label="Telepon"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Tanggal Masuk"
            type="date"
            required
            value={form.hire_date}
            onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))}
          />
          <Input
            label="Gaji Pokok (Rp)"
            type="number"
            min="0"
            value={form.salary_amount}
            onChange={(e) => setForm((f) => ({ ...f, salary_amount: e.target.value }))}
          />
          <Input
            label="Komisi (0-1, contoh 0.02 = 2%)"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={form.commission_rate}
            onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
          />
          <Input
            label="Quick PIN (4-6 digit, opsional)"
            value={form.pin_code}
            onChange={(e) => setForm((f) => ({ ...f, pin_code: e.target.value }))}
          />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jabatan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Gaji Pokok</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Komisi</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              {canManage && <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada karyawan</td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {s.first_name} {s.last_name ?? ''}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.position}</td>
                  <td className="px-4 py-2 text-gray-600">{s.salary_amount ? formatCurrency(s.salary_amount) : '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{Math.round(s.commission_rate * 100)}%</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleStatus(s)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {s.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
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
