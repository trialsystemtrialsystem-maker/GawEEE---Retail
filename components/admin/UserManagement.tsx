'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { ROLE_LABELS } from '@/lib/utils/constants'
import { formatDateTime } from '@/lib/utils/formatting'

interface AdminUser {
  user_id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  outlet_id: string | null
  outlet_name: string | null
  status: string
  last_login: string | null
}
interface Outlet { id: string; name: string }

const EMPTY = { email: '', full_name: '', phone: '', role: 'cashier', outlet_id: '' }
const ROLES = [
  { value: 'outlet_manager', label: 'Manajer Outlet' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'staff', label: 'Staff' },
]

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (debounced) params.set('search', debounced)
    if (roleFilter) params.set('role', roleFilter)
    if (outletFilter) params.set('outlet_id', outletFilter)
    if (statusFilter) params.set('status', statusFilter)
    const [uRes, oRes] = await Promise.all([fetch(`/api/admin/users?${params}`), fetch('/api/outlets')])
    const [uData, oData] = await Promise.all([uRes.json(), oRes.json()])
    if (uRes.ok) setUsers(uData.users ?? [])
    if (oRes.ok) setOutlets(oData.outlets ?? [])
    setIsLoading(false)
  }, [debounced, roleFilter, outletFilter, statusFilter])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      const res = editing
        ? await fetch(`/api/admin/users/${editing.user_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: form.full_name, phone: form.phone || null, ...(editing.role !== 'master_admin' ? { role: form.role, outlet_id: form.outlet_id } : {}) }) })
        : await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, phone: form.phone || undefined }) })
      const data = await res.json()
      if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
      if (!editing) setNotice(`Pengguna dibuat. Password sementara (tampil sekali, sampaikan ke yang bersangkutan): ${data.temp_password}`)
      setForm(EMPTY)
      setEditing(null)
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function setActive(u: AdminUser, active: boolean) {
    setError(null)
    const res = await fetch(`/api/admin/users/${u.user_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: active ? 'active' : 'inactive' }) })
    const data = await res.json()
    if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal mengubah status')
    load()
  }

  async function resetPassword(u: AdminUser) {
    if (!window.confirm(`Atur ulang password ${u.full_name}? Password lama tidak berlaku lagi.`)) return
    setError(null)
    const res = await fetch(`/api/admin/users/${u.user_id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal mengatur ulang password')
    setNotice(`Password baru ${data.email}: ${data.temp_password} (tampil sekali, sampaikan ke yang bersangkutan)`)
  }

  const select = 'rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const activeCount = users.filter((u) => u.status === 'active').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pengguna</h2>
          <p className="text-sm text-gray-500">{users.length} pengguna · {activeCount} aktif</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm((v) => !v || !!editing); setEditing(null); setForm({ ...EMPTY, outlet_id: outlets[0]?.id ?? '' }); setError(null) }}>
          {showForm && !editing ? 'Batal' : '+ Tambah Pengguna'}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input name="user_search" placeholder="Cari nama atau email…" aria-label="Cari pengguna" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter peran" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={select}>
          <option value="">Semua Peran</option>
          <option value="master_admin">Master Admin</option>
          {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
        </select>
        <select aria-label="Filter outlet" value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className={select}>
          <option value="">Semua Outlet</option>
          {outlets.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
        </select>
        <select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={select}>
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <ExportCsvButton filename="pengguna" rows={users.map((u) => ({ Nama: u.full_name, Email: u.email, Telepon: u.phone ?? '', Peran: ROLE_LABELS[u.role] ?? u.role, Outlet: u.outlet_name ?? '', Status: u.status, 'Login Terakhir': u.last_login ?? '' }))} />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <p className="font-medium text-gray-900 sm:col-span-2">{editing ? `Ubah ${editing.full_name}` : 'Pengguna baru'}</p>
            <Input name="email" label="Email" type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input name="full_name" label="Nama Lengkap" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            <Input name="phone" label="Telepon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            {editing?.role !== 'master_admin' && (
              <>
                <div className="space-y-1">
                  <label htmlFor="u_role" className="block text-sm font-medium text-gray-700">Peran</label>
                  <select id="u_role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={`w-full ${select}`}>
                    {ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="u_outlet" className="block text-sm font-medium text-gray-700">Outlet</label>
                  <select id="u_outlet" required value={form.outlet_id} onChange={(e) => setForm((f) => ({ ...f, outlet_id: e.target.value }))} className={`w-full ${select}`}>
                    <option value="">Pilih outlet…</option>
                    {outlets.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" isLoading={isSubmitting}>{editing ? 'Simpan Perubahan' : 'Buat Pengguna'}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditing(null) }}>Batal</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Peran</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Outlet</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Login Terakhir</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Tidak ada pengguna yang cocok</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id} className={`hover:bg-gray-50 ${u.status === 'active' ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-2 text-gray-900">{u.full_name}<span className="block text-xs text-gray-400">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span></td>
                  <td className="px-4 py-2 text-gray-600">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-2 text-gray-600">{u.outlet_name ?? (u.role === 'master_admin' ? 'Semua outlet' : <span className="text-red-600">Belum ditetapkan</span>)}</td>
                  <td className="px-4 py-2 text-gray-500">{u.last_login ? formatDateTime(u.last_login) : 'Belum pernah'}</td>
                  <td className={`px-4 py-2 ${u.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>{u.status === 'active' ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button className="text-brand-600 hover:underline" onClick={() => { setEditing(u); setForm({ email: u.email, full_name: u.full_name, phone: u.phone ?? '', role: u.role, outlet_id: u.outlet_id ?? '' }); setShowForm(true); setError(null) }}>Ubah</button>
                    <button className="ml-3 text-brand-600 hover:underline" onClick={() => resetPassword(u)}>Reset Password</button>
                    {u.role !== 'master_admin' && (u.status === 'active' ? (
                      <button className="ml-3 text-red-600 hover:underline" onClick={() => setActive(u, false)}>Nonaktifkan</button>
                    ) : (
                      <button className="ml-3 text-emerald-600 hover:underline" onClick={() => setActive(u, true)}>Aktifkan</button>
                    ))}
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
