'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
}

interface Recipe {
  id: string
  name: string
  output_quantity: number
  products: { name: string } | null
}

type IngredientLine = { ingredient_product_id: string; quantity: string }

export function RecipeManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', output_product_id: '', output_quantity: '1' })
  const [ingredients, setIngredients] = useState<IngredientLine[]>([{ ingredient_product_id: '', quantity: '1' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [recipeRes, productRes] = await Promise.all([
      fetch(`/api/recipes?outlet_id=${outletId}`),
      fetch('/api/products?limit=200'),
    ])
    const recipeData = await recipeRes.json()
    const productData = await productRes.json()
    if (recipeRes.ok) setRecipes(recipeData.recipes ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
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
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          outlet_id: outletId,
          output_quantity: Number(form.output_quantity),
          ingredients: ingredients
            .filter((i) => i.ingredient_product_id && Number(i.quantity) > 0)
            .map((i) => ({ ingredient_product_id: i.ingredient_product_id, quantity: Number(i.quantity) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal membuat resep', 'danger')
        return
      }
      showToast('Resep berhasil dibuat', 'success')
      setForm({ name: '', output_product_id: '', output_quantity: '1' })
      setIngredients([{ ingredient_product_id: '', quantity: '1' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Batal' : '+ Buat Resep'}
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Nama Resep" required placeholder="Roti Tawar 1 Loyang" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Produk Hasil</label>
              <select required value={form.output_product_id} onChange={(e) => setForm((f) => ({ ...f, output_product_id: e.target.value }))} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih produk…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Jumlah Hasil per Batch" type="number" min="1" required value={form.output_quantity} onChange={(e) => setForm((f) => ({ ...f, output_quantity: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Bahan per Batch</p>
            {ingredients.map((line, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
                <select
                  required
                  value={line.ingredient_product_id}
                  onChange={(e) => setIngredients((prev) => prev.map((l, idx) => (idx === i ? { ...l, ingredient_product_id: e.target.value } : l)))}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih bahan…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => setIngredients((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: e.target.value } : l)))}
                  className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {ingredients.length > 1 && (
                  <button type="button" onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))} className="text-sm text-red-500 hover:text-red-700">
                    Hapus
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setIngredients((prev) => [...prev, { ingredient_product_id: '', quantity: '1' }])} className="text-sm font-medium text-blue-600 hover:text-blue-700">
              + Tambah bahan
            </button>
          </div>

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Resep
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama Resep</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Produk Hasil</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Hasil per Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : recipes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">Belum ada resep</td>
              </tr>
            ) : (
              recipes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-gray-700">{r.products?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.output_quantity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
