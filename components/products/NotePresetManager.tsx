'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface NotePreset {
  id: string
  label: string
}

export function NotePresetManager({ outletId }: { outletId: string }) {
  const [presets, setPresets] = useState<NotePreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/note-presets?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setPresets(data.presets ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/note-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, label }),
      })
      if (res.ok) {
        setLabel('')
        showToast('Catatan ditambahkan', 'success')
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/note-presets/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mis. Tanpa MSG, Extra Pedas" required className="flex-1" />
        <Button type="submit" isLoading={isSubmitting}>+ Tambah</Button>
      </form>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {presets.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400">Belum ada preset catatan</li>
          ) : (
            presets.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{p.label}</span>
                <button type="button" onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">
                  Hapus
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
