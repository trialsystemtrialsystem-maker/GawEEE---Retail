'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface Broadcast {
  id: string
  target_note: string
  status: string
  sent_count: number
  created_at: string
  sent_at: string | null
  whatsapp_templates: { name: string } | null
}

interface TemplateOption {
  id: string
  name: string
}

export function WhatsappBroadcasts({ outletId }: { outletId: string }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ template_id: '', target_note: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [broadcastRes, templateRes] = await Promise.all([
      fetch(`/api/whatsapp/broadcasts?outlet_id=${outletId}`),
      fetch(`/api/whatsapp/templates?outlet_id=${outletId}`),
    ])
    const broadcastData = await broadcastRes.json()
    const templateData = await templateRes.json()
    if (broadcastRes.ok) setBroadcasts(broadcastData.broadcasts ?? [])
    if (templateRes.ok) setTemplates(templateData.templates ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal mengirim broadcast')
        return
      }
      showToast(`Broadcast terkirim ke ${data.broadcast.sent_count} pelanggan`, 'success')
      setForm({ template_id: '', target_note: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Broadcast</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={templates.length === 0}>
          {showForm ? 'Batal' : '+ Kirim Broadcast'}
        </Button>
      </div>

      {templates.length === 0 && !isLoading && (
        <Alert variant="warning">Buat template pesan terlebih dahulu sebelum mengirim broadcast.</Alert>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleSend} className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Template <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pilih template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Target Audiens"
            required
            placeholder="Contoh: Pelanggan yang bertransaksi minggu ini"
            value={form.target_note}
            onChange={(e) => setForm((f) => ({ ...f, target_note: e.target.value }))}
          />
          <p className="text-xs text-gray-500">
            Jumlah penerima dihitung dari pelanggan bernomor telepon yang tercatat di outlet ini.
          </p>
          <Button type="submit" isLoading={isSubmitting}>
            Kirim Sekarang
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Template</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Target</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Penerima</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dikirim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : broadcasts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada broadcast</td>
              </tr>
            ) : (
              broadcasts.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{b.whatsapp_templates?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{b.target_note}</td>
                  <td className="px-4 py-2 text-gray-600">{b.sent_count}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {b.sent_at ? new Date(b.sent_at).toLocaleString('id-ID') : '-'}
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
