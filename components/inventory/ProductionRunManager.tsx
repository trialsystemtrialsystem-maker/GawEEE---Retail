'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Recipe {
  id: string
  name: string
  output_quantity: number
}

interface Run {
  id: string
  batch_count: number
  status: string
  created_at: string
  completed_at: string | null
  recipes: { name: string } | null
}

export function ProductionRunManager({ outletId, canManage }: { outletId: string; canManage: boolean }) {
  const [runs, setRuns] = useState<Run[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ recipe_id: '', batch_count: '1' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [runRes, recipeRes] = await Promise.all([
      fetch(`/api/production-runs?outlet_id=${outletId}`),
      fetch(`/api/recipes?outlet_id=${outletId}`),
    ])
    const runData = await runRes.json()
    const recipeData = await recipeRes.json()
    if (runRes.ok) setRuns(runData.runs ?? [])
    if (recipeRes.ok) setRecipes(recipeData.recipes ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/production-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, batch_count: Number(form.batch_count) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat production run')
        return
      }
      showToast('Production run dibuat', 'success')
      setForm({ recipe_id: '', batch_count: '1' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitRun(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/production-runs/${id}/submit`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menyelesaikan produksi', 'danger')
        return
      }
      showToast(`Produksi selesai, ${data.output_quantity} unit ditambahkan ke stok`, 'success')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {recipes.length === 0 && !isLoading && (
        <Alert variant="info">Buat resep terlebih dahulu di menu Master Recipes.</Alert>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={recipes.length === 0}>
            {showForm ? 'Batal' : '+ Buat Production Run'}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Resep</label>
            <select required value={form.recipe_id} onChange={(e) => setForm((f) => ({ ...f, recipe_id: e.target.value }))} className="w-56 rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Pilih resep…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.output_quantity}/batch)
                </option>
              ))}
            </select>
          </div>
          <Input label="Jumlah Batch" type="number" min="1" required value={form.batch_count} onChange={(e) => setForm((f) => ({ ...f, batch_count: e.target.value }))} />
          <Button type="submit" isLoading={isSubmitting}>
            Buat
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Resep</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Batch</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dibuat</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada production run</td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{r.recipes?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.batch_count}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.status === 'completed' ? 'Selesai' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.status === 'draft' && canManage && (
                      <button onClick={() => submitRun(r.id)} disabled={busyId === r.id} className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                        Selesaikan Produksi
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
