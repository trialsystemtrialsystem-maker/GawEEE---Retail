'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Facility {
  id: string
  name: string
  capacity: number | null
  description: string | null
}

export function FacilityManager({ outletId }: { outletId: string }) {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/facilities?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setFacilities(data.facilities ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, name, capacity: capacity ? Number(capacity) : undefined, description: description || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah fasilitas', 'danger')
        return
      }
      setName('')
      setCapacity('')
      setDescription('')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(facility: Facility) {
    const ok = window.confirm(`Nonaktifkan fasilitas "${facility.name}"?`)
    if (!ok) return
    setBusyId(facility.id)
    try {
      await fetch(`/api/facilities/${facility.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Fasilitas'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input label="Nama Fasilitas" required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Ruang VIP 1" />
          <Input label="Kapasitas (opsional)" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <Input label="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan Fasilitas
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Fasilitas</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Kapasitas</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Deskripsi</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : facilities.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada fasilitas</td></tr>
            ) : (
              facilities.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{f.name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{f.capacity ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{f.description ?? '-'}</td>
                  <td className="px-4 py-2">
                    <button type="button" disabled={busyId === f.id} onClick={() => handleDelete(f)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                      Nonaktifkan
                    </button>
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
