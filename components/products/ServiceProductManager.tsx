'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface ServiceProduct {
  id: string
  sku: string
  name: string
  selling_price: number
  is_active: boolean
}

// A service has no stock — deliberately kept OUT of the inventory table
// entirely (not given a fake huge stock number), so it never pollutes
// inventory reports/low-stock alerts. The POS grid merges service products
// in separately as always-available. See Phase 13 Batch E item 12 — the
// one deliberate create_invoice()/void_invoice() change this phase (skips
// stock validation/deduction/restore for product_type='service').
export function ServiceProductManager() {
  const [services, setServices] = useState<ServiceProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/products?product_type=service&status=active&limit=200')
    const data = await res.json()
    if (res.ok) setServices(data.data ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku || `SVC-${Date.now()}`,
          name,
          selling_price: Number(price),
          purchase_price: 0,
          unit_type: 'layanan',
          reorder_level: 0,
          reorder_quantity: 0,
          product_type: 'service',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menambah layanan', 'danger')
        return
      }
      setName('')
      setSku('')
      setPrice('')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeactivate(service: ServiceProduct) {
    const ok = window.confirm(`Nonaktifkan layanan "${service.name}"?`)
    if (!ok) return
    setBusyId(service.id)
    try {
      await fetch(`/api/products/${service.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">Layanan tidak memiliki konsep stok — muncul di Kasir sebagai selalu tersedia, tidak pernah mengurangi inventaris.</Alert>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Layanan'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input label="Nama Layanan" required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Jasa Potong Rambut" />
          <Input label="SKU (opsional)" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="dibuat otomatis jika kosong" />
          <Input label="Harga (Rp)" type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
          <div className="sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan Layanan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">SKU</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Layanan</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Harga</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : services.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada layanan</td></tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{s.sku}</td>
                  <td className="px-4 py-2 text-gray-900">{s.name}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatCurrency(s.selling_price)}</td>
                  <td className="px-4 py-2">
                    <button type="button" disabled={busyId === s.id} onClick={() => handleDeactivate(s)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
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
