'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { INDUSTRY_LABELS } from '@/lib/utils/constants'

const initialState = {
  company_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  industry: 'minimarket',
  outlet_count: 'single' as 'single' | 'multi',
}

export function SignUpForm() {
  const router = useRouter()
  const [form, setForm] = useState(initialState)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  function update<K extends keyof typeof initialState>(key: K, value: (typeof initialState)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!agreedToTerms) {
      setError('Anda harus menyetujui Terms of Service.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error?.fieldErrors) {
          const flat: Record<string, string> = {}
          for (const [key, messages] of Object.entries(data.error.fieldErrors as Record<string, string[]>)) {
            if (messages?.[0]) flat[key] = messages[0]
          }
          setFieldErrors(flat)
        } else {
          setError(typeof data.error === 'string' ? data.error : 'Gagal mendaftar, coba lagi.')
        }
        return
      }

      router.push('/auth/verify-email')
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
        label="Nama Perusahaan/Toko"
        name="company_name"
        required
        value={form.company_name}
        onChange={(e) => update('company_name', e.target.value)}
        error={fieldErrors.company_name}
      />
      <Input
        label="Email"
        type="email"
        name="email"
        required
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        error={fieldErrors.email}
      />
      <Input
        label="No. Telepon"
        name="phone"
        required
        value={form.phone}
        onChange={(e) => update('phone', e.target.value)}
        error={fieldErrors.phone}
      />
      <Input
        label="Password"
        type="password"
        name="password"
        required
        value={form.password}
        onChange={(e) => update('password', e.target.value)}
        error={fieldErrors.password}
      />
      <Input
        label="Confirm Password"
        type="password"
        name="confirm_password"
        required
        value={form.confirm_password}
        onChange={(e) => update('confirm_password', e.target.value)}
        error={fieldErrors.confirm_password}
      />

      <div className="space-y-1">
        <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
          Tipe Bisnis <span className="text-red-500">*</span>
        </label>
        <select
          id="industry"
          value={form.industry}
          onChange={(e) => update('industry', e.target.value)}
          className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(INDUSTRY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-gray-700">Jumlah Outlet</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="outlet_count"
            checked={form.outlet_count === 'single'}
            onChange={() => update('outlet_count', 'single')}
          />
          Satu toko saja
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="outlet_count"
            checked={form.outlet_count === 'multi'}
            onChange={() => update('outlet_count', 'multi')}
          />
          Multi-outlet (&gt; 1 toko)
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 rounded border-gray-300"
        />
        Saya setuju dengan Terms of Service
      </label>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Daftar
      </Button>

      <p className="text-center text-sm text-gray-600">
        Sudah punya akun?{' '}
        <a href="/auth/login" className="text-blue-500 hover:underline">
          Masuk di sini
        </a>
      </p>
    </form>
  )
}
