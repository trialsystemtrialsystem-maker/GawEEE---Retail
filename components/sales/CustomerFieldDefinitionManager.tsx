'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Definition {
  id: string
  label: string
}

export function CustomerFieldDefinitionManager({ outletId }: { outletId: string }) {
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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
              <li key={d.id} className="px-4 py-2 text-sm text-gray-900">
                {d.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
