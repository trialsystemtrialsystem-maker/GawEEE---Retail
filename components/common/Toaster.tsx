'use client'

import { useNotificationStore } from '@/store/notificationStore'

const VARIANT_CLASS: Record<string, string> = {
  success: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  danger: 'border-red-500 bg-red-50 text-red-800',
  warning: 'border-amber-500 bg-amber-50 text-amber-800',
  info: 'border-blue-500 bg-blue-50 text-blue-800',
}

export function Toaster() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismiss = useNotificationStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2" role="region" aria-label="Notifikasi">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          aria-live="polite"
          className={`flex items-start justify-between gap-3 rounded-md border-l-4 p-3 text-sm shadow-lg ${VARIANT_CLASS[toast.variant]}`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Tutup notifikasi"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
