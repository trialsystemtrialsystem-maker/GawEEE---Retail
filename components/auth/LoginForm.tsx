'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Email atau password salah')
        return
      }

      router.push(searchParams.get('redirect') || '/dashboard')
      router.refresh()
    } catch {
      setError('Terjadi kesalahan jaringan, coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}

      <Input
        label="Email"
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        name="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="rounded border-gray-300"
        />
        Ingat saya
      </label>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Masuk
      </Button>

      <div className="flex items-center justify-between text-sm">
        <a href="/auth/signup" className="text-blue-500 hover:underline">
          Buat akun baru
        </a>
        <a href="/auth/reset-password" className="text-blue-500 hover:underline">
          Lupa password?
        </a>
      </div>
    </form>
  )
}
