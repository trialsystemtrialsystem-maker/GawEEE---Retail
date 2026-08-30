'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { useNotificationStore } from '@/store/notificationStore'

export function BulkPriceUpdateForm() {
  const [direction, setDirection] = useState<'price_increase' | 'price_decrease'>('price_increase')
  const [percentage, setPercentage] = useState('5')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/bulk-operations/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_type: direction,
          outlets: ['all'],
          parameters: { percentage: Number(percentage) },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menjalankan operasi')
        return
      }
      setResult(`Berhasil memperbarui ${data.preview.products_affected} produk.`)
      showToast(`Harga ${data.preview.products_affected} produk berhasil diperbarui`, 'success')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Update Harga Massal</h2>
      <p className="text-sm text-gray-500">
        Mengubah harga jual seluruh produk di perusahaan sekaligus. Dijalankan langsung (belum ada
        penjadwalan — lihat todo.md).
      </p>

      {error && <Alert variant="danger">{error}</Alert>}
      {result && <Alert variant="success">{result}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-gray-700">Arah Perubahan</legend>
          <label className="mr-4 inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={direction === 'price_increase'}
              onChange={() => setDirection('price_increase')}
            />
            Naikkan Harga
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={direction === 'price_decrease'}
              onChange={() => setDirection('price_decrease')}
            />
            Turunkan Harga
          </label>
        </fieldset>

        <Input
          label="Persentase (%)"
          type="number"
          min={0.1}
          step={0.1}
          required
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
        />

        <Button type="submit" isLoading={isSubmitting}>
          Jalankan Sekarang
        </Button>
      </form>
    </Card>
  )
}
