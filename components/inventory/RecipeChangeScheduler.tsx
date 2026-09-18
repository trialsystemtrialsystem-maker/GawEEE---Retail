'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Product {
  id: string
  name: string
}
interface Recipe {
  id: string
  name: string
  products: { name: string } | null
}
interface Schedule {
  id: string
  recipe_id: string
  new_ingredients: { ingredient_product_id: string; quantity: number }[]
  effective_date: string
  applied: boolean
  recipes: { name: string } | null
}
type IngredientLine = { ingredient_product_id: string; quantity: string }

export function RecipeChangeScheduler({ outletId }: { outletId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [recipeId, setRecipeId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [ingredients, setIngredients] = useState<IngredientLine[]>([{ ingredient_product_id: '', quantity: '1' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [scheduleRes, recipeRes, productRes] = await Promise.all([
      fetch(`/api/recipe-change-schedules?outlet_id=${outletId}`),
      fetch(`/api/recipes?outlet_id=${outletId}`),
      fetch('/api/products?limit=200'),
    ])
    const scheduleData = await scheduleRes.json()
    const recipeData = await recipeRes.json()
    const productData = await productRes.json()
    if (scheduleRes.ok) setSchedules(scheduleData.schedules ?? [])
    if (recipeRes.ok) setRecipes(recipeData.recipes ?? [])
    if (productRes.ok) setProducts(productData.data ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(async () => {
      const applyRes = await fetch(`/api/recipe-change-schedules/apply?outlet_id=${outletId}`, { method: 'POST' })
      const applyData = await applyRes.json()
      if (applyRes.ok) setAppliedCount(applyData.applied_count ?? 0)
      load()
    }, 0)
    return () => clearTimeout(t)
  }, [load, outletId])

  async function handleRecipeChange(id: string) {
    setRecipeId(id)
    if (!id) return
    const res = await fetch(`/api/recipes/${id}`)
    const data = await res.json()
    if (res.ok && data.ingredients?.length) {
      setIngredients(data.ingredients.map((i: { ingredient_product_id: string; quantity: number }) => ({ ingredient_product_id: i.ingredient_product_id, quantity: String(i.quantity) })))
    }
  }

  function updateIngredient(i: number, patch: Partial<IngredientLine>) {
    setIngredients((prev) => prev.map((line, idx) => (idx === i ? { ...line, ...patch } : line)))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const validLines = ingredients.filter((l) => l.ingredient_product_id && Number(l.quantity) > 0)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/recipe-change-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipeId,
          effective_date: effectiveDate,
          new_ingredients: validLines.map((l) => ({ ingredient_product_id: l.ingredient_product_id, quantity: Number(l.quantity) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menjadwalkan perubahan resep', 'danger')
        return
      }
      setRecipeId('')
      setEffectiveDate('')
      setIngredients([{ ingredient_product_id: '', quantity: '1' }])
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancel(schedule: Schedule) {
    setBusyId(schedule.id)
    try {
      await fetch(`/api/recipe-change-schedules/${schedule.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        Jadwal perubahan resep diterapkan otomatis saat halaman ini dibuka — bukan cron real-time. Buka halaman ini di hari H untuk memastikan resep berubah.
      </Alert>
      {appliedCount !== null && appliedCount > 0 && <Alert variant="success">{appliedCount} jadwal perubahan resep baru saja diterapkan.</Alert>}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Jadwalkan Perubahan'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Resep</label>
              <select
                required
                value={recipeId}
                onChange={(e) => handleRecipeChange(e.target.value)}
                className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Pilih resep…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.products?.name})
                  </option>
                ))}
              </select>
            </div>
            <Input name="effective_date" label="Berlaku Mulai" type="date" required value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Bahan Baru (menggantikan seluruh bahan resep saat ini)</label>
            {ingredients.map((line, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select
                  value={line.ingredient_product_id}
                  onChange={(e) => updateIngredient(i, { ingredient_product_id: e.target.value })}
                  className="min-w-[180px] flex-1 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Pilih bahan…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input type="number" min={1} className="w-24" value={line.quantity} onChange={(e) => updateIngredient(i, { quantity: e.target.value })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}>
                  Hapus
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setIngredients((prev) => [...prev, { ingredient_product_id: '', quantity: '1' }])}>
              + Tambah Bahan
            </Button>
          </div>

          <Button type="submit" isLoading={isSubmitting}>
            Simpan Jadwal
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Resep</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jumlah Bahan Baru</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Berlaku</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada jadwal perubahan resep</td></tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{s.recipes?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{s.new_ingredients.length} bahan</td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(s.effective_date)}</td>
                  <td className="px-4 py-2">
                    {s.applied ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Sudah diterapkan</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Menunggu</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!s.applied && (
                      <button type="button" disabled={busyId === s.id} onClick={() => handleCancel(s)} className="text-xs text-red-500 hover:underline disabled:opacity-50">
                        Batalkan
                      </button>
                    )}
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
