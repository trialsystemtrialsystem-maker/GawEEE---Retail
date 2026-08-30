'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface WhatsappTemplate {
  id: string
  name: string
  content: string
  created_at: string
}

export function WhatsappTemplates({ outletId }: { outletId: string }) {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', content: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/whatsapp/templates?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setTemplates(data.templates ?? [])
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
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan template')
        return
      }
      showToast(`Template "${form.name}" berhasil disimpan`, 'success')
      setForm({ name: '', content: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus template "${name}"?`)) return
    const res = await fetch(`/api/whatsapp/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Template dihapus', 'success')
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Template Pesan</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Template Baru'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <Input
            label="Nama Template"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Textarea
            label="Isi Pesan"
            required
            rows={3}
            placeholder="Halo {nama}, pesanan Anda sudah siap diambil. Terima kasih!"
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
          <p className="text-xs text-gray-500">
            Gunakan <code className="rounded bg-gray-100 px-1">{'{nama}'}</code> untuk menyisipkan nama pelanggan otomatis.
          </p>
          <Button type="submit" isLoading={isSubmitting}>
            Simpan
          </Button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-400">Belum ada template pesan.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <button
                  onClick={() => handleDelete(t.id, t.name)}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700"
                >
                  Hapus
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{t.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
