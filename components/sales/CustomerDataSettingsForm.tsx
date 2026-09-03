'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useNotificationStore } from '@/store/notificationStore'

interface Group {
  id: string
  name: string
}

// Outlet-wide customer module behavior — distinct from Customer Custom
// Fields (which defines per-customer data columns): this is toggles, not a
// data schema. See Phase 13 Batch B item 4.
export function CustomerDataSettingsForm({ outletId }: { outletId: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [requirePhone, setRequirePhone] = useState(false)
  const [defaultGroupId, setDefaultGroupId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [groupRes, settingsRes] = await Promise.all([
      fetch(`/api/customer-groups?outlet_id=${outletId}`),
      fetch(`/api/customer-module-settings?outlet_id=${outletId}`),
    ])
    const groupData = await groupRes.json()
    const settingsData = await settingsRes.json()
    if (groupRes.ok) setGroups(groupData.groups ?? [])
    if (settingsRes.ok) {
      setRequirePhone(!!settingsData.settings?.require_phone_on_checkout)
      setDefaultGroupId(settingsData.settings?.default_group_id ?? '')
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/customer-module-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          require_phone_on_checkout: requirePhone,
          default_group_id: defaultGroupId || null,
        }),
      })
      if (res.ok) showToast('Pengaturan pelanggan disimpan', 'success')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>

  return (
    <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 p-4">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)} />
        Wajibkan nomor telepon saat menambah pelanggan baru
      </label>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Grup Pelanggan Default</label>
        <select
          value={defaultGroupId}
          onChange={(e) => setDefaultGroupId(e.target.value)}
          className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tanpa grup default</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">Otomatis dipilih saat kasir/staf menambah pelanggan baru dari Customer List.</p>
      </div>

      <Button onClick={handleSave} isLoading={isSaving}>
        Simpan Pengaturan
      </Button>
    </div>
  )
}
