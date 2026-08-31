'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Group {
  id: string
  name: string
  description: string | null
}

export function CustomerGroupList({ outletId }: { outletId: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/customer-groups?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setGroups(data.groups ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/customer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId }),
      })
      if (res.ok) {
        showToast(`Grup "${form.name}" berhasil dibuat`, 'success')
        setForm({ name: '', description: '' })
        setShowForm(false)
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Grup'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input label="Nama Grup" required placeholder="Pelanggan VIP" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Deskripsi" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">Belum ada grup pelanggan</td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{g.name}</td>
                  <td className="px-4 py-2 text-gray-600">{g.description ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
