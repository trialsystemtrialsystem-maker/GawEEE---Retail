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

// Reflects the actual role checks enforced in the API routes (not just a
// wishlist) — see e.g. app/api/purchase-orders/[id]/approve, app/api/
// invoices/[id]/void, app/api/inventory/adjust, app/api/admin/*.
const PERMISSION_MATRIX: { action: string; master_admin: boolean; outlet_manager: boolean; cashier: boolean; staff: boolean }[] = [
  { action: 'Transaksi Kasir (POS)', master_admin: true, outlet_manager: true, cashier: true, staff: true },
  { action: 'Void Invoice', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Adjust Stok', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Kelola Produk & Supplier', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Approve Purchase Order', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Post Jurnal Akuntansi', master_admin: true, outlet_manager: true, cashier: false, staff: false },
  { action: 'Kelola Karyawan & Payroll', master_admin: true, outlet_manager: true, cashier: false, staff: false },
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
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Matriks Izin per Role</h2>
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
                        className="rounded-sm border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
