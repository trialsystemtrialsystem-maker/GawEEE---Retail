'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Template {
  id: string
  name: string
}
interface Group {
  id: string
  name: string
}
interface Campaign {
  id: string
  target_note: string
  sent_count: number
  sent_at: string | null
  whatsapp_templates: { name: string } | null
}

export function CampaignSendManager({ outletId }: { outletId: string }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templateId, setTemplateId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [templateRes, groupRes, campaignRes] = await Promise.all([
      fetch(`/api/whatsapp/templates?outlet_id=${outletId}`),
      fetch(`/api/customer-groups?outlet_id=${outletId}`),
      fetch(`/api/whatsapp/broadcasts?outlet_id=${outletId}`),
    ])
    const templateData = await templateRes.json()
    const groupData = await groupRes.json()
    const campaignData = await campaignRes.json()
    if (templateRes.ok) setTemplates(templateData.templates ?? [])
    if (groupRes.ok) setGroups(groupData.groups ?? [])
    if (campaignRes.ok) setCampaigns(campaignData.broadcasts ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    try {
      const targetGroup = groups.find((g) => g.id === groupId)
      const res = await fetch('/api/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          template_id: templateId,
          customer_group_id: groupId || undefined,
          target_note: targetGroup ? `Grup: ${targetGroup.name}` : 'Semua pelanggan bertransaksi',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Gagal mengirim campaign', 'danger')
        return
      }
      showToast(`Campaign terkirim ke ${data.broadcast.sent_count} pelanggan`, 'success')
      setTemplateId('')
      setGroupId('')
      load()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 && !isLoading && (
        <Alert variant="warning">Buat template pesan di menu WhatsApp terlebih dahulu.</Alert>
      )}

      <form onSubmit={handleSend} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Template Pesan</label>
          <select required value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Pilih template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Target Grup</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua pelanggan bertransaksi</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" isLoading={isSending} disabled={templates.length === 0}>
            Kirim Campaign
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Template</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Target</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-600">Penerima</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Dikirim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada campaign</td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{c.whatsapp_templates?.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.target_note}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{c.sent_count}</td>
                  <td className="px-4 py-2 text-gray-500">{c.sent_at ? formatDateTime(c.sent_at) : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
