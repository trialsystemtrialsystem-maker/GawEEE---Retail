'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface UserRow {
  user_id: string
  email: string
  full_name: string
  role: string
  outlet_name: string | null
  status: string
}

const ROLE_LABEL: Record<string, string> = {
  master_admin: 'Master Admin',
  outlet_manager: 'Manajer Outlet',
  cashier: 'Kasir',
  staff: 'Staf',
}

const ROLES = ['master_admin', 'outlet_manager', 'cashier', 'staff'] as const

// Fixed actions (not configurable yet) — reflect the hardcoded role checks in
// the API routes. Configurable actions live in the editable matrix rendered
// above this one (lib/utils/permissions.ts).
const PERMISSION_MATRIX: { action: string; master_admin: boolean; outlet_manager: boolean; cashier: boolean; staff: boolean }[] = [
  { action: 'Transaksi Kasir (POS)', master_admin: true, outlet_manager: true, cashier: true, staff: true },
  { action: 'Kelola Produk', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Kelola Karyawan', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Kelola Outlet & Undang User', master_admin: true, outlet_manager: false, cashier: false, staff: false },
  { action: 'Lihat Semua Outlet (multi-outlet)', master_admin: true, outlet_manager: false, cashier: false, staff: false },
]

export function AccessRightsManager({ isMasterAdmin }: { isMasterAdmin: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    if (!isMasterAdmin) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (res.ok) setUsers(data.users ?? [])
    setIsLoading(false)
  }, [isMasterAdmin])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const [editable, setEditable] = useState<{
    permissions: { key: string; label: string }[]
    roles: string[]
    matrix: Record<string, Record<string, boolean>>
  } | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!isMasterAdmin) return
    const timeout = setTimeout(async () => {
      const res = await fetch('/api/admin/permissions')
      if (res.ok) setEditable(await res.json())
    }, 0)
    return () => clearTimeout(timeout)
  }, [isMasterAdmin])

  async function togglePermission(role: string, key: string, allowed: boolean) {
    const id = `${role}:${key}`
    setTogglingKey(id)
    // Optimistic — reverted below if the save fails.
    setEditable((e) => (e ? { ...e, matrix: { ...e.matrix, [role]: { ...e.matrix[role], [key]: allowed } } } : e))
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, key, allowed }),
      })
      if (!res.ok) throw new Error('save failed')
      showToast('Izin diperbarui', 'success')
    } catch {
      setEditable((e) => (e ? { ...e, matrix: { ...e.matrix, [role]: { ...e.matrix[role], [key]: !allowed } } } : e))
      showToast('Gagal memperbarui izin', 'danger')
    } finally {
      setTogglingKey(null)
    }
  }

  async function changeRole(userId: string, role: string) {
    setSavingId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        showToast('Role berhasil diubah', 'success')
        load()
      } else {
        showToast('Gagal mengubah role', 'danger')
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {isMasterAdmin && editable && (
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Izin yang Dapat Diatur</h2>
          <p className="mb-3 text-sm text-gray-500">
            Centang untuk mengizinkan sebuah peran melakukan aksi. Berlaku langsung; Master Admin selalu memiliki semua izin.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-600">{ROLE_LABEL.master_admin}</th>
                  {editable.roles.map((r) => (
                    <th key={r} className="px-4 py-2 text-center font-semibold text-gray-600">
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {editable.permissions.map((p) => (
                  <tr key={p.key}>
                    <td className="px-4 py-2 text-gray-700">{p.label}</td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked disabled aria-label={`${p.label} — ${ROLE_LABEL.master_admin}`} />
                    </td>
                    {editable.roles.map((r) => (
                      <td key={r} className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={editable.matrix[r]?.[p.key] ?? false}
                          disabled={togglingKey === `${r}:${p.key}`}
                          onChange={(e) => togglePermission(r, p.key, e.target.checked)}
                          aria-label={`${p.label} — ${ROLE_LABEL[r]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Izin Tetap per Role</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-2 text-center font-semibold text-gray-600">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.action}>
                  <td className="px-4 py-2 text-gray-700">{row.action}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-4 py-2 text-center">
                      {row[r] ? (
                        <span style={{ color: 'var(--status-good)' }}>✓</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Ubah Role Pengguna</h2>
        {!isMasterAdmin ? (
          <Alert variant="info">Hanya Master Admin yang dapat mengubah role pengguna.</Alert>
        ) : isLoading ? (
          <p className="text-sm text-gray-400">Memuat…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada pengguna</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Outlet</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td className="px-4 py-2 text-gray-900">{u.full_name}</td>
                    <td className="px-4 py-2 text-gray-600">{u.outlet_name ?? '-'}</td>
                    <td className="px-4 py-2">
                      <select
                        value={u.role}
                        disabled={savingId === u.user_id}
                        onChange={(e) => changeRole(u.user_id, e.target.value)}
                        className="rounded-sm border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
