'use client'

import { useState } from 'react'
import { WhatsappTemplates } from '@/components/whatsapp/WhatsappTemplates'
import { WhatsappBroadcasts } from '@/components/whatsapp/WhatsappBroadcasts'

const TABS = [
  { key: 'templates', label: 'Template Pesan' },
  { key: 'broadcasts', label: 'Broadcast' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function WhatsappPageClient({ outletId }: { outletId: string }) {
  const [tab, setTab] = useState<TabKey>('templates')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' ? <WhatsappTemplates outletId={outletId} /> : <WhatsappBroadcasts outletId={outletId} />}
    </div>
  )
}
