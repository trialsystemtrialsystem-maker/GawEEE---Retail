'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatDate } from '@/lib/utils/formatting'
import { findConflicts } from '@/lib/utils/bookingConflicts'
import { useNotificationStore } from '@/store/notificationStore'

interface Booking {
  id: string
  customer_name: string
  customer_phone: string | null
  item_description: string
  scheduled_date: string
  scheduled_start_time: string
  scheduled_end_time: string | null
  status: string
  notes: string | null
  staff_id: string | null
  facility_id: string | null
  staff_members: { first_name: string; last_name: string | null } | null
  facilities: { name: string } | null
}
interface StaffOption { id: string; first_name: string; last_name: string | null }
interface FacilityOption { id: string; name: string }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  no_show: 'Tidak Hadir',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-300',
  confirmed: 'bg-brand-50 text-brand-700 border-blue-300',
  in_progress: 'bg-violet-50 text-violet-700 border-violet-300',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  cancelled: 'bg-red-50 text-red-700 border-red-300',
  no_show: 'bg-gray-100 text-gray-600 border-gray-300',
}
const NEXT_STATUS: Record<string, { to: string; label: string } | null> = {
  pending: { to: 'confirmed', label: 'Konfirmasi' },
  confirmed: { to: 'in_progress', label: 'Mulai' },
  in_progress: { to: 'completed', label: 'Selesaikan' },
  completed: null,
  cancelled: null,
  no_show: null,
}

const EMPTY = { customer_name: '', customer_phone: '', item_description: '', staff_id: '', facility_id: '', scheduled_date: '', scheduled_start_time: '', scheduled_end_time: '', notes: '' }
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const hm = (t: string | null) => (t ? t.slice(0, 5) : '')

function whatsappLink(b: Booking) {
  const digits = (b.customer_phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const number = digits.startsWith('0') ? `62${digits.slice(1)}` : digits
  const text = `Halo ${b.customer_name}, mengingatkan booking Anda: ${b.item_description} pada ${formatDate(b.scheduled_date)} pukul ${hm(b.scheduled_start_time)}. Terima kasih!`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function BookingsManager({ outletId, canForce = true }: { outletId: string; canForce?: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [start, setStart] = useState(() => iso(Date.now()))
  const [end, setEnd] = useState(() => iso(Date.now() + 14 * 86_400_000))
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictHint, setConflictHint] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const showToast = useNotificationStore((s) => s.show)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setIsLoading(true)
    const params = new URLSearchParams({ outlet_id: outletId, start, end })
    if (statusFilter) params.set('status', statusFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    const [bookingsRes, staffRes, facilitiesRes] = await Promise.all([fetch(`/api/bookings?${params}`), fetch(`/api/staff?outlet_id=${outletId}`), fetch(`/api/facilities?outlet_id=${outletId}`)])
    const [bookingsData, staffData, facilitiesData] = await Promise.all([bookingsRes.json(), staffRes.json(), facilitiesRes.json()])
    if (bookingsRes.ok) setBookings(bookingsData.bookings ?? [])
    if (staffRes.ok) setStaff(staffData.staff ?? [])
    if (facilitiesRes.ok) setFacilities(facilitiesData.facilities ?? [])
    setIsLoading(false)
  }, [outletId, start, end, statusFilter, debouncedSearch])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  // Overlaps inside the visible list (e.g. force-booked ones) get flagged.
  const clashing = useMemo(() => {
    const ids = new Set<string>()
    for (const b of bookings) {
      if (findConflicts(b, bookings).length > 0) ids.add(b.id)
    }
    return ids
  }, [bookings])

  const [todayIso] = useState(() => iso(Date.now()))
  const kpi = {
    today: bookings.filter((b) => b.scheduled_date === todayIso && !['cancelled', 'no_show'].includes(b.status)).length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    upcoming: bookings.filter((b) => b.scheduled_date >= todayIso && ['pending', 'confirmed'].includes(b.status)).length,
    lost: bookings.filter((b) => ['cancelled', 'no_show'].includes(b.status)).length,
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const b of bookings) map.set(b.scheduled_date, [...(map.get(b.scheduled_date) ?? []), b])
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [bookings])

  function startEdit(b: Booking) {
    setForm({
      customer_name: b.customer_name, customer_phone: b.customer_phone ?? '', item_description: b.item_description, staff_id: b.staff_id ?? '', facility_id: b.facility_id ?? '',
      scheduled_date: b.scheduled_date, scheduled_start_time: hm(b.scheduled_start_time), scheduled_end_time: hm(b.scheduled_end_time), notes: b.notes ?? '',
    })
    setEditingId(b.id)
    setShowForm(true)
    setError(null)
    setConflictHint(false)
  }

  async function submit(e: React.FormEvent | null, force = false) {
    e?.preventDefault()
    setError(null)
    setConflictHint(false)
    setIsSubmitting(true)
    try {
      const common = {
        customer_name: form.customer_name,
        item_description: form.item_description,
        scheduled_date: form.scheduled_date,
        scheduled_start_time: form.scheduled_start_time,
        ...(force ? { force: true } : {}),
      }
      const res = editingId
        ? await fetch(`/api/bookings/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...common, customer_phone: form.customer_phone || null, staff_id: form.staff_id || null, facility_id: form.facility_id || null, scheduled_end_time: form.scheduled_end_time || null, notes: form.notes || null }),
          })
        : await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // an empty string is valid to Zod but Postgres rejects "" for a
            // `time` column, so blanks are omitted, never sent as ''.
            body: JSON.stringify({ ...common, outlet_id: outletId, customer_phone: form.customer_phone || undefined, staff_id: form.staff_id || undefined, facility_id: form.facility_id || undefined, scheduled_end_time: form.scheduled_end_time || undefined, notes: form.notes || undefined }),
          })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal menyimpan booking')
        setConflictHint(res.status === 409)
        return
      }
      showToast(editingId ? 'Booking diperbarui' : 'Booking berhasil ditambahkan', 'success')
      setForm(EMPTY)
      setEditingId(null)
      setShowForm(false)
      load()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function patchStatus(id: string, status: string, reason?: string) {
    setError(null)
    const res = await fetch(`/api/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...(reason ? { cancel_reason: reason } : {}) }) })
    const data = await res.json()
    if (!res.ok) return setError(typeof data.error === 'string' ? data.error : 'Gagal mengubah status')
    load()
  }

  function cancelWithReason(b: Booking, status: 'cancelled' | 'no_show') {
    const reason = window.prompt(status === 'cancelled' ? 'Alasan pembatalan (opsional):' : 'Catatan (opsional):')
    if (reason === null) return
    patchStatus(b.id, status, reason || undefined)
  }

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))
  const select = 'w-full rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs text-gray-500">Hari Ini</p><p className="text-xl font-bold text-gray-900">{kpi.today}</p></Card>
        <Card><p className="text-xs text-gray-500">Menunggu Konfirmasi</p><p className={`text-xl font-bold ${kpi.pending ? 'text-amber-600' : 'text-gray-900'}`}>{kpi.pending}</p></Card>
        <Card><p className="text-xs text-gray-500">Akan Datang</p><p className="text-xl font-bold text-gray-900">{kpi.upcoming}</p></Card>
        <Card><p className="text-xs text-gray-500">Batal / Tidak Hadir</p><p className={`text-xl font-bold ${kpi.lost ? 'text-red-600' : 'text-gray-900'}`}>{kpi.lost}</p></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input name="bk_start" label="Dari" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input name="bk_end" label="Sampai" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sm border border-gray-200 px-3 py-2 text-sm">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <div className="min-w-[12rem] flex-1">
          <Input placeholder="Cari nama, telepon, layanan…" aria-label="Cari booking" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ExportCsvButton
          filename={`booking-${start}_${end}`}
          rows={bookings.map((b) => ({ Tanggal: b.scheduled_date, Mulai: hm(b.scheduled_start_time), Selesai: hm(b.scheduled_end_time), Pelanggan: b.customer_name, Telepon: b.customer_phone ?? '', Layanan: b.item_description, Staf: b.staff_members ? `${b.staff_members.first_name} ${b.staff_members.last_name ?? ''}`.trim() : '', Fasilitas: b.facilities?.name ?? '', Status: STATUS_LABEL[b.status] ?? b.status }))}
        />
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setEditingId(null); setForm(EMPTY); setError(null) }}>
          {showForm ? 'Tutup' : '+ Tambah Booking'}
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          {error}
          {conflictHint && canForce && (
            <button className="ml-3 underline" onClick={() => submit(null, true)}>Tetap simpan (double-booking)</button>
          )}
        </Alert>
      )}

      {showForm && (
        <form onSubmit={(e) => submit(e)} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
          <p className="font-medium text-gray-900 sm:col-span-3">{editingId ? 'Ubah / jadwalkan ulang booking' : 'Booking baru'}</p>
          <Input name="booking_customer_name" label="Nama Pelanggan" required value={form.customer_name} onChange={(e) => set({ customer_name: e.target.value })} />
          <Input name="booking_customer_phone" label="No. Telepon" value={form.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} />
          <Input name="booking_item_description" label="Layanan / Item" required placeholder="Contoh: Kue Ulang Tahun Custom 2kg" value={form.item_description} onChange={(e) => set({ item_description: e.target.value })} />
          <Input name="booking_scheduled_date" label="Tanggal" type="date" required value={form.scheduled_date} onChange={(e) => set({ scheduled_date: e.target.value })} />
          <Input name="booking_scheduled_start_time" label="Jam Mulai" type="time" required value={form.scheduled_start_time} onChange={(e) => set({ scheduled_start_time: e.target.value })} />
          <Input name="booking_scheduled_end_time" label="Jam Selesai (opsional)" type="time" value={form.scheduled_end_time} onChange={(e) => set({ scheduled_end_time: e.target.value })} />
          <div className="space-y-1">
            <label htmlFor="booking_staff" className="block text-sm font-medium text-gray-700">Staf (opsional)</label>
            <select id="booking_staff" value={form.staff_id} onChange={(e) => set({ staff_id: e.target.value })} className={select}>
              <option value="">— Tidak ditentukan —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name ?? ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="booking_facility" className="block text-sm font-medium text-gray-700">Fasilitas (opsional)</label>
            <select id="booking_facility" value={form.facility_id} onChange={(e) => set({ facility_id: e.target.value })} className={select}>
              <option value="">— Tidak ditentukan —</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <Input name="booking_notes" label="Catatan" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          <div className="flex items-end gap-2 sm:col-span-3">
            <Button type="submit" isLoading={isSubmitting}>{editingId ? 'Simpan Perubahan' : 'Simpan'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Batal</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-lg border border-gray-200 p-6 text-center text-gray-400">Tidak ada booking pada rentang ini</p>
      ) : (
        grouped.map(([date, list]) => (
          <div key={date} className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-700">{formatDate(date)}{date === todayIso ? ' · Hari ini' : ''} <span className="font-normal text-gray-400">({list.length})</span></h3>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {list.map((b) => {
                const next = NEXT_STATUS[b.status]
                const wa = whatsappLink(b)
                const active = !['completed', 'cancelled', 'no_show'].includes(b.status)
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 last:border-b-0">
                    <div className="min-w-[14rem]">
                      <p className="font-medium text-gray-900">
                        <span className="mr-2 font-mono text-sm text-gray-500">{hm(b.scheduled_start_time)}{b.scheduled_end_time ? `–${hm(b.scheduled_end_time)}` : ''}</span>
                        {b.customer_name}
                        {clashing.has(b.id) && active && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700" title="Jadwal bertabrakan dengan booking lain">Bentrok</span>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {b.item_description}
                        {b.staff_members && <span className="text-gray-400"> · {b.staff_members.first_name}</span>}
                        {b.facilities && <span className="text-gray-400"> · {b.facilities.name}</span>}
                      </p>
                      {b.notes && <p className="text-xs text-gray-400">{b.notes.split('\n').at(-1)}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status] ?? b.status}</span>
                      {next && <Button size="sm" variant="secondary" onClick={() => patchStatus(b.id, next.to)}>{next.label}</Button>}
                      {active && <button className="text-sm text-brand-600 hover:underline" onClick={() => startEdit(b)}>Ubah</button>}
                      {wa && active && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline">Ingatkan</a>}
                      {b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'no_show' && (
                        <>
                          {b.status !== 'in_progress' && <button className="text-sm text-gray-500 hover:underline" onClick={() => cancelWithReason(b, 'no_show')}>Tidak hadir</button>}
                          <button className="text-sm text-red-600 hover:underline" onClick={() => cancelWithReason(b, 'cancelled')}>Batalkan</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
