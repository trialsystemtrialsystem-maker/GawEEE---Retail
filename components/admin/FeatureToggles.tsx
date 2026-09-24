'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { FEATURES, isFeatureEnabled, type FeatureFlags } from '@/lib/nav/features'
import { resetFeatureFlagsCache } from '@/lib/hooks/useFeatureFlags'
import { useNotificationStore } from '@/store/notificationStore'

export function FeatureToggles() {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [error, setError] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    fetch('/api/features')
      .then((r) => r.json())
      .then((d) => setFlags(d.features ?? {}))
      .catch(() => setError('Gagal memuat pengaturan fitur'))
  }, [])

  async function toggle(key: string, enabled: boolean) {
    setError(null)
    const res = await fetch('/api/admin/features', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, enabled }) })
    const data = await res.json()
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan')
      return
    }
    setFlags(data.features)
    resetFeatureFlagsCache()
    showToast(`Modul ${enabled ? 'diaktifkan' : 'dinonaktifkan'}. Muat ulang halaman untuk melihat menu terbaru.`, 'success')
  }

  return (
    <div className="space-y-4">
      <Alert variant="info">
        Menonaktifkan modul hanya menyembunyikan menunya bagi pengguna lain. Data tidak dihapus, dan Master Admin tetap melihat menu tersebut (ditandai
        &quot;nonaktif&quot;) agar bisa mengaktifkannya kembali.
      </Alert>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FEATURES.map((f) => {
          const enabled = isFeatureEnabled(flags, f.key)
          return (
            <Card key={f.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{f.label}</p>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
              <input type="checkbox" checked={enabled} onChange={(e) => toggle(f.key, e.target.checked)} aria-label={`Aktifkan ${f.label}`} className="h-5 w-5" />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
