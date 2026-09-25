'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { formatDateTime } from '@/lib/utils/formatting'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { Input } from '@/components/ui/Input'

interface LogEntry {
  id: string
  action_type: string
  entity_type: string
  entity_id: string
  reason_for_action: string | null
  status: string | null
  created_at: string
  user_name: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VOID', 'EXPORT']
const ACTION_CLASS: Record<string, string> = { CREATE: 'bg-emerald-50 text-emerald-700', UPDATE: 'bg-blue-50 text-blue-700', DELETE: 'bg-red-50 text-red-700', VOID: 'bg-red-50 text-red-700', EXPORT: 'bg-gray-100 text-gray-600' }

export function AuditLogTable() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (action) params.set('action_type', action)
    if (entity) params.set('entity_type', entity)
    if (debounced) params.set('search', debounced)
    if (start) params.set('from_date', `${start}T00:00:00.000Z`)
    if (end) params.set('to_date', `${end}T23:59:59.999Z`)
    try {
      const res = await fetch(`/api/admin/audit-log?${params}`)
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Gagal memuat audit log')
      setLogs(data.logs ?? [])
      setPages(data.pagination?.pages ?? 1)
      setTotal(data.pagination?.total ?? 0)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [page, action, entity, debounced, start, end])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const select = 'rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const brief = (v: Record<string, unknown> | null) => (v ? Object.entries(v).slice(0, 3).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(' · ') : '')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <select aria-label="Filter aksi" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} className={select}>
          <option value="">Semua Aksi</option>
          {ACTIONS.map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>
        <Input name="audit_entity" placeholder="Jenis data (mis. user, invoice)" aria-label="Jenis data" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} />
        <Input name="audit_search" placeholder="Cari alasan…" aria-label="Cari" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input name="audit_start" label="Dari" type="date" value={start} onChange={(e) => { setStart(e.target.value); setPage(1) }} />
        <Input name="audit_end" label="Sampai" type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPage(1) }} />
        <ExportCsvButton filename="audit-log" rows={logs.map((l) => ({ Waktu: l.created_at, Pengguna: l.user_name ?? '', Aksi: l.action_type, Data: l.entity_type, ID: l.entity_id, Alasan: l.reason_for_action ?? '', Status: l.status ?? '', Sebelum: l.old_values ? JSON.stringify(l.old_values) : '', Sesudah: l.new_values ? JSON.stringify(l.new_values) : '' }))} />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Waktu</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Pengguna</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Aksi</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Data</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Ringkasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Memuat…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Tidak ada catatan yang cocok</td></tr>
              ) : (
                logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(openId === l.id ? null : l.id)}>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDateTime(l.created_at)}</td>
                      <td className="px-3 py-2 text-gray-900">{l.user_name ?? '-'}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLASS[l.action_type] ?? 'bg-gray-100 text-gray-600'}`}>{l.action_type}</span></td>
                      <td className="px-3 py-2 text-gray-700">{l.entity_type}</td>
                      <td className="max-w-md truncate px-3 py-2 text-gray-500">{l.reason_for_action ?? brief(l.new_values)}</td>
                    </tr>
                    {openId === l.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                            <div><p className="mb-1 font-semibold text-gray-600">Sebelum</p><pre className="overflow-x-auto rounded bg-white p-2 text-gray-700">{l.old_values ? JSON.stringify(l.old_values, null, 2) : '—'}</pre></div>
                            <div><p className="mb-1 font-semibold text-gray-600">Sesudah</p><pre className="overflow-x-auto rounded bg-white p-2 text-gray-700">{l.new_values ? JSON.stringify(l.new_values, null, 2) : '—'}</pre></div>
                          </div>
                          <p className="mt-2 text-xs text-gray-400">ID data: {l.entity_id}{l.reason_for_action ? ` · Alasan: ${l.reason_for_action}` : ''}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} catatan · halaman {page} dari {pages}</span>
          <div className="flex gap-2">
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelumnya</button>
            <button className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
          </div>
        </div>
      )}
    </div>
  )
}
