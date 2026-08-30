import { Card } from '@/components/ui/Card'

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <Card className="space-y-2 text-center">
        <p className="text-4xl">🚧</p>
        <p className="font-medium text-gray-900">Fitur ini belum tersedia</p>
        <p className="mx-auto max-w-md text-sm text-gray-500">{description}</p>
      </Card>
    </div>
  )
}
