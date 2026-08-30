import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-600">Halaman yang Anda cari tidak ditemukan.</p>
      <Link href="/dashboard" className="rounded-md bg-blue-500 px-6 py-2 font-semibold text-white hover:bg-blue-600">
        Ke Dashboard
      </Link>
    </div>
  )
}
