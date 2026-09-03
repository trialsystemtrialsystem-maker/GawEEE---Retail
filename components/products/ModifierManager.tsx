'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
  selling_price: number
}
interface ModifierOption {
  id: string
  label: string
  linked_product_id: string | null
  products: { name: string; selling_price: number } | null
}
interface ModifierGroup {
  id: string
  name: string
  product_modifier_options: ModifierOption[]
}

// Manager UI for "Extra Product" — defines modifier groups/options per
// product. A priced option (linked_product_id set) adds a real product as
// its own cart line at checkout; an unpriced option attaches a note. See
// Phase 13 Batch A item 3.
export function ModifierManager() {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false)
  const [optionDraft, setOptionDraft] = useState<Record<string, { label: string; linked_product_id: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/products?limit=200')
    const data = await res.json()
    if (res.ok) setProducts(data.data ?? [])
  }, [])

  const loadGroups = useCallback(async () => {
    if (!productId) {
      setGroups([])
      return
    }
    setIsLoading(true)
    const res = await fetch(`/api/product-modifiers?product_id=${productId}`)
    const data = await res.json()
    if (res.ok) setGroups(data.groups ?? [])
    setIsLoading(false)
  }, [productId])

  useEffect(() => {
    const t = setTimeout(loadProducts, 0)
    return () => clearTimeout(t)
  }, [loadProducts])

  useEffect(() => {
    const t = setTimeout(loadGroups, 0)
    return () => clearTimeout(t)
  }, [loadGroups])

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmittingGroup(true)
    try {
      const res = await fetch('/api/product-modifier-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, name: groupName }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah grup', 'danger')
        return
      }
      setGroupName('')
      loadGroups()
    } finally {
      setIsSubmittingGroup(false)
    }
  }

  async function handleDeleteGroup(group: ModifierGroup) {
    const ok = window.confirm(`Hapus grup "${group.name}" beserta seluruh pilihannya?`)
    if (!ok) return
    setBusyId(group.id)
    try {
      await fetch(`/api/product-modifier-groups/${group.id}`, { method: 'DELETE' })
      loadGroups()
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddOption(groupId: string, e: React.FormEvent) {
    e.preventDefault()
    const draft = optionDraft[groupId]
    if (!draft?.label) return
    setBusyId(groupId)
    try {
      const res = await fetch('/api/product-modifier-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          label: draft.label,
          linked_product_id: draft.linked_product_id || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah pilihan', 'danger')
        return
      }
      setOptionDraft((d) => ({ ...d, [groupId]: { label: '', linked_product_id: '' } }))
      loadGroups()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteOption(option: ModifierOption) {
    setBusyId(option.id)
    try {
      await fetch(`/api/product-modifier-options/${option.id}`, { method: 'DELETE' })
      loadGroups()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700">Pilih Produk</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 w-full max-w-md rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-auto"
        >
          <option value="">Pilih produk…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {!productId ? (
        <Alert variant="info">Pilih produk di atas untuk mengatur grup pilihan tambahannya (mis. Level Pedas, Tambahan Topping).</Alert>
      ) : isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{g.name}</h3>
                <Button size="sm" variant="ghost" isLoading={busyId === g.id} onClick={() => handleDeleteGroup(g)}>
                  Hapus Grup
                </Button>
              </div>

              <ul className="mt-2 divide-y divide-gray-100">
                {g.product_modifier_options.length === 0 && <li className="py-2 text-sm text-gray-400">Belum ada pilihan</li>}
                {g.product_modifier_options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {o.label}
                      {o.products ? (
                        <span className="ml-2 text-emerald-600">+{formatCurrency(o.products.selling_price)}</span>
                      ) : (
                        <span className="ml-2 text-gray-400">(tanpa biaya tambahan)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => handleDeleteOption(o)}
                      className="text-red-500 hover:underline disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={(e) => handleAddOption(g.id, e)} className="mt-3 flex flex-wrap items-end gap-2">
                <Input
                  label="Nama Pilihan"
                  required
                  value={optionDraft[g.id]?.label ?? ''}
                  onChange={(e) => setOptionDraft((d) => ({ ...d, [g.id]: { label: e.target.value, linked_product_id: d[g.id]?.linked_product_id ?? '' } }))}
                  placeholder="mis. Extra Keju"
                  className="w-40"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700">Produk Berbayar (opsional)</label>
                  <select
                    value={optionDraft[g.id]?.linked_product_id ?? ''}
                    onChange={(e) => setOptionDraft((d) => ({ ...d, [g.id]: { label: d[g.id]?.label ?? '', linked_product_id: e.target.value } }))}
                    className="mt-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Tanpa biaya tambahan</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatCurrency(p.selling_price)})
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" isLoading={busyId === g.id}>
                  + Tambah Pilihan
                </Button>
              </form>
            </div>
          ))}

          <form onSubmit={handleAddGroup} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 p-4">
            <Input label="Nama Grup Baru" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="mis. Level Pedas" className="w-48" />
            <Button type="submit" size="sm" variant="secondary" isLoading={isSubmittingGroup}>
              + Tambah Grup
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
