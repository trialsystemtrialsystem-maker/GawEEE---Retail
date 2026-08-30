'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { formatDateTime } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Announcement {
  id: string
  message: string
  created_at: string
  users: { full_name: string } | null
}

export function StaffAnnouncements({ outletId, canPost }: { outletId: string; canPost: boolean }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch(`/api/staff-announcements?outlet_id=${outletId}`)
    const data = await res.json()
    if (res.ok) setAnnouncements(data.announcements ?? [])
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/staff-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, message }),
      })
      if (res.ok) {
        showToast('Pengumuman terkirim', 'success')
        setMessage('')
        load()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canPost && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border border-gray-200 p-4">
          <Textarea
            label="Pesan Pengumuman"
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contoh: Besok toko buka jam 07.00 untuk stock opname."
          />
          <Button type="submit" isLoading={isSubmitting}>
            Kirim Pengumuman
          </Button>
        </form>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-400">Memuat…</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada pengumuman</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-900">{a.message}</p>
              <p className="mt-1 text-xs text-gray-400">
                {a.users?.full_name ?? 'Sistem'} · {formatDateTime(a.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
