'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useNotificationStore } from '@/store/notificationStore'

export function TryDemoButton({ className }: { className?: string }) {
  const router = useRouter()
  const showToast = useNotificationStore((s) => s.show)
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    setIsLoading(true)
    try {
      const seedRes = await fetch('/api/demo/seed', { method: 'POST' })
      const seedData = await seedRes.json()
      if (!seedRes.ok) {
        showToast(typeof seedData.error === 'string' ? seedData.error : 'Gagal menyiapkan data demo', 'danger')
        return
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: seedData.email, password: seedData.password }),
      })
      if (!loginRes.ok) {
        showToast('Data demo siap, tapi login otomatis gagal — coba masuk manual.', 'warning')
        router.push('/auth/login')
        return
      }

      showToast('Data demo siap! 3 bulan riwayat transaksi Toko Frozen Fresh sudah dimuat.', 'success')
      router.push('/dashboard')
      router.refresh()
    } catch {
      showToast('Terjadi kesalahan jaringan, coba lagi.', 'danger')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="lg" isLoading={isLoading} onClick={handleClick} className={className}>
      {isLoading ? 'Menyiapkan data demo…' : '🚀 Coba Demo (Data Terisi Penuh)'}
    </Button>
  )
}
