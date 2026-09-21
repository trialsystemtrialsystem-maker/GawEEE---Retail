'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Outlet {
  id: string
  name: string
  address: string
  city: string
  phone: string | null
  status: string
}

const STATUS_LABELS: Record<string, string> = { active: 'Aktif', inactive: 'Nonaktif', closed: 'Tutup' }

// Pure CRUD for outlet master data (Master Admin > Outlets) — deliberately
// separate from the Outlet performance/identification page (Sales >
// Dashboard > Outlet), which reads live sales metrics instead. See
// todo.md Phase 28.
export function OutletMasterData() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/outlets/list')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal memuat data outlet')
        return
      }
      setOutlets(json.outlets ?? [])
      setError(null)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(typeof result.error === 'string' ? result.error : 'Gagal menambah outlet')
        return
      }
      showToast(`Outlet "${form.name}" berhasil ditambahkan`, 'success')
      setForm({ name: '', address: '', city: '', phone: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleStatus(outlet: Outlet) {
    setTogglingId(outlet.id)
    try {
      const nextStatus = outlet.status === 'active' ? 'inactive' : 'active'
      const res = await fetch(`/api/outlets/${outlet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        showToast(`Outlet "${outlet.name}" sekarang ${STATUS_LABELS[nextStatus].toLowerCase()}`, 'success')
        load()
      }
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Outlet'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              name="outlet_name"
              label="Nama Outlet"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input name="outlet_city" label="Kota" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <Input
              name="outlet_address"
              label="Alamat"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <Input
              name="outlet_phone"
              label="Telepon"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Button type="submit" isLoading={isSubmitting}>
                Simpan Outlet
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Daftar Outlet</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-4">Nama</th>
                <th className="py-2 pr-4">Kota</th>
                <th className="py-2 pr-4">Alamat</th>
                <th className="py-2 pr-4">Telepon</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : outlets.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">Belum ada outlet</td></tr>
              ) : (
                outlets.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-4 font-medium text-gray-900">{o.name}</td>
                    <td className="py-2 pr-4 text-gray-700">{o.city}</td>
                    <td className="py-2 pr-4 text-gray-700">{o.address}</td>
                    <td className="py-2 pr-4 text-gray-700">{o.phone ?? '-'}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => toggleStatus(o)}
                        disabled={togglingId === o.id}
                        className="text-sm font-medium text-[var(--brand-600)] hover:underline disabled:opacity-50"
                      >
                        {o.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
