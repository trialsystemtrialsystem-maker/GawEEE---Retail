'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Review {
  id: string
  customer_name: string | null
  customer_phone: string | null
  rating: number
  comment: string | null
  created_at: string
}

// No live review-collection channel exists — this logs feedback given
// verbally or via WhatsApp, same honesty convention as the other simulated
// channels in this app. See Phase 13 Batch B item 6.
export function CustomerSatisfactionManager({ outletId }: { outletId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/customer-reviews?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setReviews(data.reviews ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/customer-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: name || undefined,
          customer_phone: phone || undefined,
          rating,
          comment: comment || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal menyimpan ulasan', 'danger')
        return
      }
      setName('')
      setPhone('')
      setRating(5)
      setComment('')
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(review: Review) {
    const ok = window.confirm('Hapus ulasan ini?')
    if (!ok) return
    setBusyId(review.id)
    try {
      await fetch(`/api/customer-reviews/${review.id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star: `${star} ★`, count: reviews.filter((r) => r.rating === star).length }))

  return (
    <div className="space-y-4">
      <Alert variant="info">Belum ada channel ulasan online otomatis — catat umpan balik yang disampaikan pelanggan secara langsung atau via WhatsApp di sini.</Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Rating Rata-rata</p>
          <p className="text-3xl font-bold text-gray-900">
            {avgRating.toFixed(1)} <span className="text-lg text-amber-500">★</span>
          </p>
          <p className="text-xs text-gray-400">{reviews.length} ulasan tercatat</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Distribusi Rating</h3>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="star" tick={{ fill: 'var(--foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'var(--chart-surface)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {distribution.map((d) => (
                    <Cell key={d.star} fill="var(--chart-1)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Catat Ulasan'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input label="Nama Pelanggan (opsional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Telepon (opsional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                  {'☆'.repeat(5 - n)}
                </option>
              ))}
            </select>
          </div>
          <Input label="Komentar (opsional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan Ulasan
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-gray-200">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-400">Memuat…</p>
        ) : reviews.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada ulasan tercatat</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reviews.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">
                    <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
                    <span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>{' '}
                    {r.customer_name ?? 'Anonim'}
                    {r.customer_phone && <span className="text-gray-400"> · {r.customer_phone}</span>}
                  </p>
                  {r.comment && <p className="text-gray-600">{r.comment}</p>}
                  <p className="text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                </div>
                <button type="button" disabled={busyId === r.id} onClick={() => handleDelete(r)} className="shrink-0 text-xs text-red-500 hover:underline disabled:opacity-50">
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
