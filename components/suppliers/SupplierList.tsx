'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  payment_terms: number | null
  status: string
}

export function SupplierList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await fetch('/api/suppliers')
    const data = await res.json()
    if (res.ok) setSuppliers(data.suppliers ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah supplier')
        return
      }
      setForm({ name: '', contact_person: '', phone: '', email: '' })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Daftar Supplier</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Supplier'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input
            label="Nama Supplier"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Kontak Person"
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
          />
          <Input
            label="Telepon"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting}>
              Simpan
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Nama</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Kontak</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Telepon</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada supplier</td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{s.name}</td>
                  <td className="px-4 py-2 text-gray-600">{s.contact_person ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{s.phone ?? '-'}</td>
                  <td className="px-4 py-2 text-emerald-600">{s.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
