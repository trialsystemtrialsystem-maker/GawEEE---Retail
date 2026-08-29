'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ROLE_LABELS } from '@/lib/utils/constants'

interface AdminUser {
  user_id: string
  email: string
  full_name: string
  role: string
  outlet_name: string | null
  status: string
}

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'cashier' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (res.ok) setUsers(data.users ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah pengguna')
        return
      }
      setNotice(`Pengguna dibuat. Password sementara: ${data.temp_password}`)
      setForm({ email: '', full_name: '', phone: '', role: 'cashier' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pengguna</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Pengguna'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {showForm && (
        <form onSubmit={handleInvite} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Nama Lengkap" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          <Input label="Telepon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="outlet_manager">Manajer Outlet</option>
              <option value="cashier">Kasir</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="sm:col-span-2">
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Role</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Outlet</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada pengguna</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2 text-gray-600">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-2 text-gray-600">{u.outlet_name ?? '-'}</td>
                  <td className={`px-4 py-2 ${u.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {u.status}
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
