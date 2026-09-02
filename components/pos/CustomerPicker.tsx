'use client'

import { useEffect, useState } from 'react'

interface Customer {
  id: string
  name: string
  phone: string | null
}
export interface PickedCustomer {
  name: string
  phone?: string
}

export function CustomerPicker({
  outletId,
  value,
  onChange,
}: {
  outletId: string
  value: PickedCustomer | null
  onChange: (customer: PickedCustomer | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([])
        return
      }
      const res = await fetch(`/api/customers?outlet_id=${outletId}&search=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (res.ok) setResults(data.customers ?? [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, outletId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, name: newName, phone: newPhone || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        onChange({ name: data.customer.name, phone: data.customer.phone ?? undefined })
        setShowNewForm(false)
        setNewName('')
        setNewPhone('')
        setQuery('')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (value) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Pelanggan</label>
        <div className="flex items-center justify-between rounded-lg border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-800">
            {value.name}
            {value.phone && <span className="ml-1 font-normal text-emerald-600">— {value.phone}</span>}
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-xs text-emerald-700 hover:underline">
            Ganti
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">Pelanggan (opsional)</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama/telepon…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ name: c.name, phone: c.phone ?? undefined })
                    setQuery('')
                    setResults([])
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                >
                  {c.name} {c.phone && <span className="text-gray-400">— {c.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!showNewForm ? (
        <button type="button" onClick={() => setShowNewForm(true)} className="text-xs font-medium text-emerald-600 hover:underline">
          + Pelanggan Baru
        </button>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-2">
          <input
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama"
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Telepon"
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <button type="submit" disabled={isCreating} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            Simpan
          </button>
        </form>
      )}
    </div>
  )
}
