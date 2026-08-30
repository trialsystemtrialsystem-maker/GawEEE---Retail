import Link from 'next/link'

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-2 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
          ← Kembali ke Dashboard
        </Link>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}
