'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils/formatting'
import { Alert } from '@/components/ui/Alert'

interface LogEntry {
  id: string
  action_type: string
  entity_type: string
  entity_id: string
  reason_for_action: string | null
  status: string | null
  created_at: string
}

export function AuditLogTable() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/audit-log')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Gagal memuat audit log')
          return
        }
        setLogs(data.logs ?? [])
      })
      .catch(() => setError('Terjadi kesalahan jaringan'))
      .finally(() => setIsLoading(false))
  }, [])

  if (error) return <Alert variant="danger">{error}</Alert>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Waktu</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Entitas</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Alasan</th>
            <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isLoading ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
          ) : logs.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada aktivitas tercatat</td></tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-600">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-2 font-medium text-gray-900">{log.action_type}</td>
                <td className="px-4 py-2 text-gray-600">{log.entity_type}</td>
                <td className="px-4 py-2 text-gray-600">{log.reason_for_action ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600">{log.status ?? '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
