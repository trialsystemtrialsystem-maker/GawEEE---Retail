'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { useNotificationStore } from '@/store/notificationStore'

interface Form {
  name: string
  tax_id: string
  tax_rate: string
  receipt_header: string
  receipt_footer: string
  max_cashier_discount_percent: string
}

export function SystemSettingsForm() {
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const res = await fetch('/api/admin/company-settings')
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memuat pengaturan')
        return
      }
      setForm({
        name: data.name ?? '',
        tax_id: data.tax_id ?? '',
        tax_rate: String(data.tax_rate ?? 10),
        receipt_header: data.receipt_header ?? '',
        receipt_footer: data.receipt_footer ?? '',
        max_cashier_discount_percent: String(data.max_cashier_discount_percent ?? 30),
      })
    }, 0)
    return () => clearTimeout(timeout)
  }, [])

  if (error && !form) return <Alert variant="danger">{error}</Alert>
  if (!form) return <p className="text-gray-400">Memuat…</p>

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/company-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tax_rate: Number(form.tax_rate), max_cashier_discount_percent: Number(form.max_cashier_discount_percent) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Periksa kembali isian Anda')
        return
      }
      showToast('Pengaturan sistem disimpan', 'success')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Identitas Bisnis</h2>
        <Input name="company_name" label="Nama Bisnis" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <Input name="tax_id" label="NPWP (opsional)" value={form.tax_id} onChange={(e) => set({ tax_id: e.target.value })} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Pajak</h2>
        <Input
          name="tax_rate"
          label="Tarif PPN (%)"
          type="number"
          min="0"
          max="100"
          step="0.01"
          required
          value={form.tax_rate}
          onChange={(e) => set({ tax_rate: e.target.value })}
        />
        <p className="text-sm text-gray-500">Berlaku otomatis pada transaksi baru berikutnya; transaksi yang sudah tercatat tidak berubah.</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Diskon Kasir</h2>
        <Input
          name="max_cashier_discount_percent"
          label="Batas diskon di luar promo/kupon/poin (%)"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          value={form.max_cashier_discount_percent}
          onChange={(e) => set({ max_cashier_discount_percent: e.target.value })}
        />
        <p className="text-sm text-gray-500">Diskon yang tidak berasal dari promo, kupon, atau poin (mis. paket bundle) dibatasi sebesar ini untuk kasir/staf. Manager tidak dibatasi persentase, namun tidak boleh melebihi subtotal.</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Struk</h2>
        <Input
          name="receipt_header"
          label="Teks Atas Struk"
          placeholder="mis. Jl. Contoh No. 1, Telp 0812…"
          value={form.receipt_header}
          onChange={(e) => set({ receipt_header: e.target.value })}
        />
        <Input
          name="receipt_footer"
          label="Teks Bawah Struk"
          placeholder="Terima kasih atas kunjungan Anda!"
          value={form.receipt_footer}
          onChange={(e) => set({ receipt_footer: e.target.value })}
        />
      </Card>

      <Button type="submit" isLoading={isSaving}>
        Simpan Pengaturan
      </Button>
    </form>
  )
}
