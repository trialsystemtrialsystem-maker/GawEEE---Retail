'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

interface Booking {
  id: string
  customer_name: string
  item_description: string
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string | null
  status: string
  staff_members: { first_name: string; last_name: string | null } | null
}

interface StaffOption {
  id: string
  first_name: string
  last_name: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-300',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-300',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-300',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  cancelled: 'bg-red-50 text-red-700 border-red-300',
}

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'confirmed',
  confirmed: 'in_progress',
  in_progress: 'completed',
  completed: null,
  cancelled: null,
}

export function BookingsManager({ outletId }: { outletId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    item_description: '',
    staff_id: '',
    scheduled_date: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
  })
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [bookingsRes, staffRes] = await Promise.all([
      fetch(`/api/bookings?outlet_id=${outletId}`),
      fetch(`/api/staff?outlet_id=${outletId}`),
    ])
    const bookingsData = await bookingsRes.json()
    const staffData = await staffRes.json()
    if (bookingsRes.ok) setBookings(bookingsData.bookings ?? [])
    if (staffRes.ok) setStaff(staffData.staff ?? [])
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
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, outlet_id: outletId, staff_id: form.staff_id || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menambah booking')
        return
      }
      showToast('Booking berhasil ditambahkan', 'success')
      setForm({
        customer_name: '',
        customer_phone: '',
        item_description: '',
        staff_id: '',
        scheduled_date: '',
        scheduled_start_time: '',
        scheduled_end_time: '',
      })
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Batal' : '+ Tambah Booking'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <Input
            label="Nama Pelanggan"
            required
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
          />
          <Input
            label="No. Telepon"
            value={form.customer_phone}
            onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
          />
          <Input
            label="Layanan / Item"
            required
            placeholder="Contoh: Kue Ulang Tahun Custom 2kg"
            value={form.item_description}
            onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))}
          />
          <Input
            label="Tanggal"
            type="date"
            required
            value={form.scheduled_date}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
          />
          <Input
            label="Jam Mulai"
            type="time"
            required
            value={form.scheduled_start_time}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_start_time: e.target.value }))}
          />
          <Input
            label="Jam Selesai"
            type="time"
            value={form.scheduled_end_time}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_end_time: e.target.value }))}
          />
          <div className="space-y-1 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Staf Bertugas</label>
            <select
              value={form.staff_id}
              onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))}
              className="w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-1/3"
            >
              <option value="">Belum ditentukan</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name ?? ''}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
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
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Tanggal</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Jam</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Pelanggan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Layanan</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Staf</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Belum ada booking</td>
              </tr>
            ) : (
              bookings.map((b) => {
                const next = NEXT_STATUS[b.status]
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{formatDate(b.scheduled_date)}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {b.scheduled_start_time.slice(0, 5)}
                      {b.scheduled_end_time ? ` - ${b.scheduled_end_time.slice(0, 5)}` : ''}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{b.customer_name}</td>
                    <td className="px-4 py-2 text-gray-700">{b.item_description}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {b.staff_members ? `${b.staff_members.first_name} ${b.staff_members.last_name ?? ''}` : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[b.status]}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {next && (
                          <button
                            onClick={() => updateStatus(b.id, next)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            {STATUS_LABEL[next]}
                          </button>
                        )}
                        {b.status !== 'completed' && b.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus(b.id, 'cancelled')}
                            className="text-sm font-medium text-red-500 hover:text-red-700"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
