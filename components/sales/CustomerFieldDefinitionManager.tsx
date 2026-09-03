'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Definition {
  id: string
  label: string
  is_required: boolean
}

export function CustomerFieldDefinitionManager({ outletId }: { outletId: string }) {
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/customer-field-definitions?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setDefinitions(data.definitions ?? [])
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
      const res = await fetch('/api/customer-field-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, label }),
      })
      if (res.ok) {
        showToast('Kolom kustom ditambahkan', 'success')
        setLabel('')
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleRequired(def: Definition) {
    setBusyId(def.id)
    setDefinitions((prev) => prev.map((d) => (d.id === def.id ? { ...d, is_required: !d.is_required } : d)))
    try {
      await fetch(`/api/customer-field-definitions/${def.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_required: !def.is_required }),
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(def: Definition) {
    const ok = window.confirm(`Hapus kolom "${def.label}"?`)
    if (!ok) return
    setBusyId(def.id)
    try {
      await fetch(`/api/customer-field-definitions/${def.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex items-end gap-3 rounded-lg border border-gray-200 p-4">
        <Input label="Nama Kolom" required placeholder="Tanggal Lahir" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button type="submit" isLoading={isSubmitting}>
          Tambah Kolom
        </Button>
      </form>

      <div className="rounded-lg border border-gray-200">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-400">Memuat…</p>
        ) : definitions.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada kolom kustom. Setelah ditambahkan, kolom ini akan muncul di form tambah pelanggan (Customer List).</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {definitions.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm text-gray-900">
                <span>{d.label}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input type="checkbox" checked={d.is_required} disabled={busyId === d.id} onChange={() => handleToggleRequired(d)} />
                    Wajib diisi
                  </label>
                  <button type="button" disabled={busyId === d.id} onClick={() => handleDelete(d)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
