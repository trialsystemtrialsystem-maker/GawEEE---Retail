'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  customer_groups: { name: string } | null
}

interface Group {
  id: string
  name: string
}

interface FieldDefinition {
  id: string
  label: string
  is_required: boolean
}

export function CustomerList({ outletId }: { outletId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([])
  const [requirePhone, setRequirePhone] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', group_id: '' })
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [custRes, groupRes, fieldRes, settingsRes] = await Promise.all([
      fetch(`/api/customers?outlet_id=${outletId}`),
      fetch(`/api/customer-groups?outlet_id=${outletId}`),
      fetch(`/api/customer-field-definitions?outlet_id=${outletId}`),
      fetch(`/api/customer-module-settings?outlet_id=${outletId}`),
    ])
    const custData = await custRes.json()
    const groupData = await groupRes.json()
    const fieldData = await fieldRes.json()
    const settingsData = await settingsRes.json()
    if (custRes.ok) setCustomers(custData.customers ?? [])
    if (groupRes.ok) setGroups(groupData.groups ?? [])
    if (fieldRes.ok) setFieldDefinitions(fieldData.definitions ?? [])
    if (settingsRes.ok) {
      setRequirePhone(!!settingsData.settings?.require_phone_on_checkout)
      if (settingsData.settings?.default_group_id) {
        setForm((f) => ({ ...f, group_id: f.group_id || settingsData.settings.default_group_id }))
      }
    }
    setIsLoading(false)
  }, [outletId])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          group_id: form.group_id || undefined,
          outlet_id: outletId,
          custom_fields: customFieldValues,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah pelanggan')
        return
      }
      showToast(`Pelanggan "${form.name}" berhasil ditambahkan`, 'success')
      setForm({ name: '', phone: '', email: '', notes: '', group_id: '' })
      setCustomFieldValues({})
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{customers.length} pelanggan</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Pelanggan'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <Input
            label="Nama"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Telepon"
            required={requirePhone}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Catatan"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Grup Pelanggan</label>
            <select
              value={form.group_id}
              onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tanpa grup</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          {fieldDefinitions.map((fd) => (
            <Input
              key={fd.id}
              label={fd.label}
              required={fd.is_required}
              value={customFieldValues[fd.label] ?? ''}
              onChange={(e) => setCustomFieldValues((v) => ({ ...v, [fd.label]: e.target.value }))}
            />
          ))}
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Telepon</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Email</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Catatan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Grup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada pelanggan</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{c.name}</td>
                  <td className="px-4 py-2 text-gray-600">{c.phone ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.email ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.notes ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.customer_groups?.name ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
