'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { whatsappLink } from '@/lib/utils/whatsappTemplate'
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
interface TemplateOption { id: string; name: string; content?: string }
interface GroupOption { id: string; name: string }
interface Recipient { id: string; name: string; phone: string; message: string; status: 'pending' | 'sent' | 'skipped'; sent_at: string | null }
interface Queue { broadcast: Broadcast; recipients: Recipient[]; counts: { total: number; pending: number; sent: number; skipped: number } }

const AUDIENCES = [
  { key: 'recent_buyers', label: 'Pembeli dalam N hari terakhir' },
  { key: 'lapsed', label: 'Pembeli yang sudah lama tidak belanja (N hari)' },
  { key: 'customers', label: 'Semua pelanggan terdaftar (punya nomor)' },
  { key: 'group', label: 'Satu grup pelanggan' },
] as const

export function WhatsappBroadcasts({ outletId }: { outletId: string }) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ template_id: string; target_note: string; audience: string; group_id: string; days: string }>({ template_id: '', target_note: '', audience: 'recent_buyers', group_id: '', days: '30' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [queue, setQueue] = useState<Queue | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [b, t, g] = await Promise.all([fetch(`/api/whatsapp/broadcasts?outlet_id=${outletId}`), fetch(`/api/whatsapp/templates?outlet_id=${outletId}`), fetch(`/api/customer-groups?outlet_id=${outletId}`)])
    const [bd, td, gd] = await Promise.all([b.json(), t.json(), g.json()])
    if (b.ok) setBroadcasts(bd.broadcasts ?? [])
    if (t.ok) setTemplates(td.templates ?? [])
    if (g.ok) setGroups(gd.groups ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function openQueue(id: string) {
    const res = await fetch(`/api/whatsapp/broadcasts/${id}`)
    const data = await res.json()
    if (res.ok) setQueue(data)
    else setError(typeof data.error === 'string' ? data.error : 'Gagal membuka antrian')
  }

  async function mark(status: 'sent' | 'skipped' | 'pending', ids?: string[]) {
    if (!queue) return
    await fetch(`/api/whatsapp/broadcasts/${queue.broadcast.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...(ids ? { recipient_ids: ids } : {}) }) })
    await openQueue(queue.broadcast.id)
    load()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const audience = form.audience === 'group' ? { type: 'group', group_id: form.group_id } : form.audience === 'customers' ? { type: 'customers' } : { type: form.audience, days: Number(form.days) || 30 }
      const res = await fetch('/api/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, template_id: form.template_id, target_note: form.target_note || AUDIENCES.find((a) => a.key === form.audience)?.label, audience }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat broadcast')
        return
      }
      showToast(`Antrian dibuat untuk ${data.recipients} penerima${data.opted_out_excluded ? ` (${data.opted_out_excluded} pelanggan berhenti berlangganan tidak diikutkan)` : ''}`, 'success')
      setShowForm(false)
      await load()
      openQueue(data.broadcast.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const select = 'w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <Alert variant="info">
        Belum ada integrasi WhatsApp Business API, jadi broadcast dibuat sebagai <strong>antrian pesan personal</strong>: tiap penerima punya tombol &quot;Kirim di WhatsApp&quot; yang membuka
        chat dengan pesan sudah terisi. Status &quot;terkirim&quot; hanya bertambah saat Anda benar-benar mengirim. Pelanggan yang menolak pesan promosi otomatis dikecualikan.
      </Alert>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Batal' : '+ Buat Broadcast'}</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="wa_template" className="block text-sm font-medium text-gray-700">Template</label>
            <select id="wa_template" required value={form.template_id} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))} className={select}>
              <option value="">Pilih template…</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <p className="text-xs text-gray-400">Placeholder: {'{nama} {toko} {invoice} {total} {tanggal}'}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="wa_audience" className="block text-sm font-medium text-gray-700">Penerima</label>
            <select id="wa_audience" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} className={select}>
              {AUDIENCES.map((a) => (<option key={a.key} value={a.key}>{a.label}</option>))}
            </select>
          </div>
          {(form.audience === 'recent_buyers' || form.audience === 'lapsed') && <Input name="wa_days" label="N (hari)" type="number" min="1" max="365" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} />}
          {form.audience === 'group' && (
            <div className="space-y-1">
              <label htmlFor="wa_group" className="block text-sm font-medium text-gray-700">Grup</label>
              <select id="wa_group" required value={form.group_id} onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))} className={select}>
                <option value="">Pilih grup…</option>
                {groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
              </select>
            </div>
          )}
          <Input name="wa_note" label="Catatan kampanye (opsional)" value={form.target_note} onChange={(e) => setForm((f) => ({ ...f, target_note: e.target.value }))} />
          <div className="sm:col-span-2"><Button type="submit" isLoading={isSubmitting}>Buat Antrian</Button></div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Target</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Template</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dibuat</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Terkirim</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Memuat…</td></tr>
            ) : broadcasts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Belum ada broadcast</td></tr>
            ) : (
              broadcasts.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 text-gray-900">{b.target_note}</td>
                  <td className="px-4 py-2 text-gray-600">{b.whatsapp_templates?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDateTime(b.created_at)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{b.sent_count}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{b.status === 'sent' ? 'Selesai' : 'Antrian'}</span>
                  </td>
                  <td className="px-4 py-2 text-right"><button className="text-brand-600 hover:underline" onClick={() => openQueue(b.id)}>Buka antrian</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {queue && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{queue.broadcast.target_note}</h2>
              <p className="text-sm text-gray-500">{queue.counts.sent} terkirim · {queue.counts.pending} menunggu · {queue.counts.skipped} dilewati dari {queue.counts.total} penerima</p>
            </div>
            <div className="flex gap-2">
              {queue.counts.pending > 0 && <Button size="sm" variant="secondary" onClick={() => mark('sent')}>Tandai semua terkirim</Button>}
              <Button size="sm" variant="ghost" onClick={() => setQueue(null)}>Tutup</Button>
            </div>
          </div>
          <div className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
            {queue.recipients.map((r) => {
              const link = whatsappLink(r.phone, r.message)
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-[14rem] flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.name} <span className="font-normal text-gray-400">{r.phone}</span></p>
                    <p className="line-clamp-2 text-xs text-gray-500">{r.message}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {r.status === 'pending' ? (
                      <>
                        {link && <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => mark('sent', [r.id])} className="font-medium text-emerald-600 hover:underline">Kirim di WhatsApp</a>}
                        <button className="text-gray-500 hover:underline" onClick={() => mark('skipped', [r.id])}>Lewati</button>
                      </>
                    ) : (
                      <>
                        <span className={r.status === 'sent' ? 'text-emerald-600' : 'text-gray-400'}>{r.status === 'sent' ? '✓ Terkirim' : 'Dilewati'}</span>
                        <button className="text-xs text-gray-400 hover:underline" onClick={() => mark('pending', [r.id])}>batalkan</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
