'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { useNotificationStore } from '@/store/notificationStore'

interface Outlet {
  id: string
  name: string
  address: string
  city: string
  province: string | null
  phone: string | null
  geofence_lat: number | null
  geofence_lng: number | null
  geofence_radius_m: number | null
}

export function OutletSettingsForm({ outlet, canManage }: { outlet: Outlet; canManage: boolean }) {
  const [form, setForm] = useState({
    name: outlet.name,
    address: outlet.address,
    city: outlet.city,
    province: outlet.province ?? '',
    phone: outlet.phone ?? '',
    geofence_lat: outlet.geofence_lat?.toString() ?? '',
    geofence_lng: outlet.geofence_lng?.toString() ?? '',
    geofence_radius_m: outlet.geofence_radius_m?.toString() ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showToast = useNotificationStore((s) => s.show)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/outlets/${outlet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          city: form.city,
          province: form.province,
          phone: form.phone,
          geofence_lat: form.geofence_lat ? Number(form.geofence_lat) : null,
          geofence_lng: form.geofence_lng ? Number(form.geofence_lng) : null,
          geofence_radius_m: form.geofence_radius_m ? Number(form.geofence_radius_m) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan')
        return
      }
      showToast('Pengaturan outlet berhasil disimpan', 'success')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      {!canManage && <Alert variant="info">Hanya Manajer Outlet/Master Admin yang dapat mengubah pengaturan.</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nama Outlet"
            required
            disabled={!canManage}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Telepon"
            disabled={!canManage}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Alamat"
            required
            disabled={!canManage}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label="Kota"
            required
            disabled={!canManage}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Input
            label="Provinsi"
            disabled={!canManage}
            value={form.province}
            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
          />
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold text-gray-900">Radius Absensi</h2>
          <p className="mb-3 text-sm text-gray-500">
            Batasi lokasi clock-in karyawan dalam radius tertentu dari koordinat outlet. Kosongkan untuk menonaktifkan.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Latitude"
              type="number"
              step="0.0000001"
              disabled={!canManage}
              value={form.geofence_lat}
              onChange={(e) => setForm((f) => ({ ...f, geofence_lat: e.target.value }))}
            />
            <Input
              label="Longitude"
              type="number"
              step="0.0000001"
              disabled={!canManage}
              value={form.geofence_lng}
              onChange={(e) => setForm((f) => ({ ...f, geofence_lng: e.target.value }))}
            />
            <Input
              label="Radius (meter)"
              type="number"
              min="1"
              disabled={!canManage}
              value={form.geofence_radius_m}
              onChange={(e) => setForm((f) => ({ ...f, geofence_radius_m: e.target.value }))}
            />
          </div>
        </div>

        {canManage && (
          <Button type="submit" isLoading={isSubmitting}>
            Simpan Perubahan
          </Button>
        )}
      </form>
    </Card>
  )
}
