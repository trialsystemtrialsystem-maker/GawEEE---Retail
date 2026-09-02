'use client'

import { useEffect, useState, useCallback } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useNotificationStore } from '@/store/notificationStore'

interface ChecklistItem {
  id: string
  label: string
  category: 'opening' | 'closing'
}
interface Completion {
  id: string
  item_id: string
  completed_at: string
  users: { full_name: string } | null
}

const CATEGORY_LABEL: Record<string, string> = { opening: '🌅 Buka Toko', closing: '🌙 Tutup Toko' }

export function ChecklistActivity({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showManage, setShowManage] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState<'opening' | 'closing'>('opening')
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [itemsRes, completionsRes] = await Promise.all([
      fetch(`/api/checklist-items?outlet_id=${outletId}`),
      fetch(`/api/checklist-completions?outlet_id=${outletId}&date=${today}`),
    ])
    const itemsData = await itemsRes.json()
    const completionsData = await completionsRes.json()
    if (itemsRes.ok) setItems(itemsData.items ?? [])
    if (completionsRes.ok) setCompletions(completionsData.completions ?? [])
    setIsLoading(false)
  }, [outletId, today])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  const completionByItem = new Map(completions.map((c) => [c.item_id, c]))

  async function toggleItem(item: ChecklistItem) {
    const existing = completionByItem.get(item.id)
    setBusyId(item.id)
    try {
      if (existing) {
        await fetch(`/api/checklist-completions/${existing.id}`, { method: 'DELETE' })
      } else {
        await fetch('/api/checklist-completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outlet_id: outletId, item_id: item.id, shift_date: today }),
        })
      }
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/checklist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlet_id: outletId, label: newLabel, category: newCategory }),
    })
    if (res.ok) {
      setNewLabel('')
      showToast('Item checklist ditambahkan', 'success')
      load()
    }
  }

  async function handleRemoveItem(id: string) {
    await fetch(`/api/checklist-items/${id}`, { method: 'DELETE' })
    load()
  }

  const grouped: Record<string, ChecklistItem[]> = { opening: [], closing: [] }
  for (const item of items) grouped[item.category]?.push(item)

  if (isLoading) return <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>

  return (
    <div className="space-y-4">
      {canManage && (
        <button type="button" onClick={() => setShowManage((v) => !v)} className="text-sm font-medium text-[var(--brand-600)] hover:underline">
          {showManage ? 'Tutup Kelola Checklist' : '⚙️ Kelola Checklist'}
        </button>
      )}

      {showManage && (
        <div className="space-y-3 rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-sm">
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>{CATEGORY_LABEL[item.category]} — {item.label}</span>
                <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-xs text-[var(--color-danger)] hover:underline">
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-2">
            <Input label="Item Baru" required value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="mis. Nyalakan freezer" className="flex-1" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Kategori</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as 'opening' | 'closing')}
                className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              >
                <option value="opening">Buka Toko</option>
                <option value="closing">Tutup Toko</option>
              </select>
            </div>
            <Button type="submit" size="sm">+ Tambah</Button>
          </form>
        </div>
      )}

      {(['opening', 'closing'] as const).map((category) => (
        <div key={category} className="rounded-2xl border border-[var(--brand-100)] bg-white shadow-sm">
          <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-[var(--brand-700)]">{CATEGORY_LABEL[category]}</h3>
          <ul className="divide-y divide-gray-100">
            {grouped[category].length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400">Belum ada item checklist</li>
            ) : (
              grouped[category].map((item) => {
                const completion = completionByItem.get(item.id)
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      disabled={busyId === item.id}
                      aria-label={completion ? 'Batalkan' : 'Selesai'}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold transition-colors ${
                        completion ? 'border-[var(--status-good)] bg-[var(--status-good)] text-white' : 'border-gray-300 text-transparent'
                      }`}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${completion ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.label}</p>
                      {completion && (
                        <p className="text-xs text-gray-400">
                          oleh {completion.users?.full_name ?? '-'} · {new Date(completion.completed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}
