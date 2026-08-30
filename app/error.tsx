'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Terjadi kesalahan</h1>
      <p className="max-w-md text-gray-600">
        Maaf, ada masalah saat memuat halaman ini. Coba muat ulang, atau kembali ke dashboard.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="secondary" onClick={() => router.push('/dashboard')}>
          Ke Dashboard
        </Button>
      </div>
    </div>
  )
}
