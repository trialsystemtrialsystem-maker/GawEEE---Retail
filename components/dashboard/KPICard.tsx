import { Card } from '@/components/ui/Card'

export function KPICard({
  label,
  value,
  change,
  tone = 'neutral',
}: {
  label: string
  value: string
  change?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-500' : 'text-gray-500'

  return (
    <Card className="space-y-1">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {change && <p className={`text-sm ${toneClass}`}>{change}</p>}
    </Card>
  )
}
