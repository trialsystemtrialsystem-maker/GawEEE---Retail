import { Card } from '@/components/ui/Card'

const TONE_STYLES = {
  positive: { border: 'border-l-emerald-500', chip: 'bg-emerald-50 text-emerald-700', icon: '📈' },
  negative: { border: 'border-l-red-500', chip: 'bg-red-50 text-red-700', icon: '📉' },
  neutral: { border: 'border-l-blue-500', chip: 'bg-blue-50 text-blue-700', icon: '📊' },
} as const

export function KPICard({
  label,
  value,
  change,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: string
  change?: string
  tone?: 'positive' | 'negative' | 'neutral'
  icon?: string
}) {
  const style = TONE_STYLES[tone]

  return (
    <Card className={`space-y-1 border-l-4 ${style.border}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="text-lg" aria-hidden>
          {icon ?? style.icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change && (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>{change}</span>
      )}
    </Card>
  )
}
