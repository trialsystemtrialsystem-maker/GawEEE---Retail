'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { DateRangePicker, defaultDateRange, type DateRange } from '@/components/ui/DateRangePicker'
import { ExportCsvButton } from '@/components/ui/ExportCsvButton'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/formatting'
import { formatDuration, tenureLabel } from '@/lib/utils/employeeHistory'
import { KasbonPanel } from '@/components/staff/employee/KasbonPanel'

type Row = Record<string, unknown>

interface Column {
  label: string
  render: (r: Row) => React.ReactNode
  csv: (r: Row) => string | number
  align?: 'right'
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const n = (v: unknown) => (typeof v === 'number' ? v : 0)
const time = (v: unknown) => (typeof v === 'string' && v ? formatDateTime(v).slice(-5) : '-')

const ATTENDANCE_STATUS: Record<string, string> = {
  present: 'Hadir',
  absent: 'Absen',
  late: 'Terlambat',
  early_leave: 'Pulang Cepat',
  half_day: 'Setengah Hari',
}
const LEAVE_TYPE: Record<string, string> = { izin: 'Izin', sakit: 'Sakit', libur: 'Libur', cuti: 'Cuti' }
const LEAVE_STATUS: Record<string, string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
const CATEGORY: Record<string, string> = { opening: 'Buka Toko', closing: 'Tutup Toko' }

const TABS: { key: string; label: string; columns?: Column[]; empty: string }[] = [
  { key: 'overview', label: 'Ringkasan', empty: '' },
  { key: 'kasbon', label: 'Kasbon', empty: '' },
  {
    key: 'attendance',
    label: 'Absensi',
    empty: 'Belum ada riwayat absensi pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.attendance_date)), csv: (r) => s(r.attendance_date) },
      { label: 'Shift', render: (r) => s(r.shift_name) || '-', csv: (r) => s(r.shift_name) },
      { label: 'Masuk', render: (r) => time(r.clock_in_time), csv: (r) => s(r.clock_in_time) },
      { label: 'Pulang', render: (r) => time(r.clock_out_time), csv: (r) => s(r.clock_out_time) },
      { label: 'Jam Kerja', render: (r) => (n(r.worked_minutes) ? formatDuration(n(r.worked_minutes)) : '-'), csv: (r) => n(r.worked_minutes) },
      { label: 'Status', render: (r) => ATTENDANCE_STATUS[s(r.status)] ?? s(r.status), csv: (r) => ATTENDANCE_STATUS[s(r.status)] ?? s(r.status) },
      { label: 'Terlambat', render: (r) => (n(r.late_minutes) ? `${n(r.late_minutes)} menit` : '-'), csv: (r) => n(r.late_minutes) },
      { label: 'Catatan', render: (r) => s(r.notes) || '-', csv: (r) => s(r.notes) },
    ],
  },
  {
    key: 'late',
    label: 'Terlambat',
    empty: 'Tidak ada keterlambatan pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.attendance_date)), csv: (r) => s(r.attendance_date) },
      { label: 'Jadwal Masuk', render: (r) => s(r.shift_start).slice(0, 5) || '-', csv: (r) => s(r.shift_start) },
      { label: 'Aktual Masuk', render: (r) => time(r.clock_in_time), csv: (r) => s(r.clock_in_time) },
      { label: 'Terlambat', render: (r) => (n(r.late_minutes) ? `${n(r.late_minutes)} menit` : 'Tanpa jadwal'), csv: (r) => n(r.late_minutes) },
    ],
  },
  {
    key: 'checklist',
    label: 'Ceklis Harian',
    empty: 'Belum ada ceklis yang diselesaikan pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.shift_date)), csv: (r) => s(r.shift_date) },
      { label: 'Jenis', render: (r) => CATEGORY[s(r.category)] ?? s(r.category), csv: (r) => CATEGORY[s(r.category)] ?? s(r.category) },
      { label: 'Item', render: (r) => s(r.label), csv: (r) => s(r.label) },
      { label: 'Selesai Pukul', render: (r) => time(r.completed_at), csv: (r) => s(r.completed_at) },
      { label: 'Catatan', render: (r) => s(r.note) || '-', csv: (r) => s(r.note) },
    ],
  },
  {
    key: 'leave',
    label: 'Cuti, Sakit & Izin',
    empty: 'Belum ada pengajuan libur/cuti/sakit/izin pada periode ini',
    columns: [
      { label: 'Jenis', render: (r) => LEAVE_TYPE[s(r.leave_type)] ?? s(r.leave_type), csv: (r) => LEAVE_TYPE[s(r.leave_type)] ?? s(r.leave_type) },
      { label: 'Mulai', render: (r) => formatDate(s(r.start_date)), csv: (r) => s(r.start_date) },
      { label: 'Selesai', render: (r) => formatDate(s(r.end_date)), csv: (r) => s(r.end_date) },
      { label: 'Hari', render: (r) => n(r.days), csv: (r) => n(r.days), align: 'right' },
      { label: 'Alasan', render: (r) => s(r.reason), csv: (r) => s(r.reason) },
      { label: 'Status', render: (r) => LEAVE_STATUS[s(r.status)] ?? s(r.status), csv: (r) => LEAVE_STATUS[s(r.status)] ?? s(r.status) },
      { label: 'Diputuskan', render: (r) => (s(r.decided_at) ? formatDateTime(s(r.decided_at)) : '-'), csv: (r) => s(r.decided_at) },
    ],
  },
  {
    key: 'payroll',
    label: 'Penggajian',
    empty: 'Belum ada slip gaji pada periode ini',
    columns: [
      { label: 'Periode', render: (r) => `${formatDate(s(r.period_start))} – ${formatDate(s(r.period_end))}`, csv: (r) => `${s(r.period_start)} s/d ${s(r.period_end)}` },
      { label: 'Gaji Pokok', render: (r) => formatCurrency(n(r.base_salary)), csv: (r) => n(r.base_salary), align: 'right' },
      { label: 'Komisi', render: (r) => formatCurrency(n(r.commission_amount)), csv: (r) => n(r.commission_amount), align: 'right' },
      { label: 'Potongan', render: (r) => formatCurrency(n(r.deductions)), csv: (r) => n(r.deductions), align: 'right' },
      { label: 'Gaji Bersih', render: (r) => <strong>{formatCurrency(n(r.net_pay))}</strong>, csv: (r) => n(r.net_pay), align: 'right' },
      { label: 'Status', render: (r) => (s(r.status) === 'paid' ? 'Dibayar' : 'Draft'), csv: (r) => s(r.status) },
      { label: 'Dibayar', render: (r) => (s(r.paid_at) ? formatDateTime(s(r.paid_at)) : '-'), csv: (r) => s(r.paid_at) },
    ],
  },
  {
    key: 'incentive',
    label: 'Insentif Harian',
    empty: 'Belum ada insentif pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.incentive_date)), csv: (r) => s(r.incentive_date) },
      { label: 'Aturan', render: (r) => s(r.rule_name), csv: (r) => s(r.rule_name) },
      { label: 'Sumber', render: (r) => (s(r.source) === 'auto' ? 'Otomatis' : 'Manual'), csv: (r) => (s(r.source) === 'auto' ? 'Otomatis' : 'Manual') },
      {
        label: 'Dasar Perhitungan',
        render: (r) => {
          const b = (r.basis ?? {}) as { threshold?: number; achieved?: number }
          return s(r.source) === 'manual' ? s(r.note) || '-' : `tercapai ${b.achieved ?? '-'} dari target ${b.threshold ?? '-'}`
        },
        csv: (r) => {
          const b = (r.basis ?? {}) as { threshold?: number; achieved?: number }
          return s(r.source) === 'manual' ? s(r.note) : `tercapai ${b.achieved ?? '-'} dari target ${b.threshold ?? '-'}`
        },
      },
      { label: 'Nominal', render: (r) => <strong>{formatCurrency(n(r.amount))}</strong>, csv: (r) => n(r.amount), align: 'right' },
    ],
  },
  {
    key: 'sales',
    label: 'Penjualan',
    empty: 'Belum ada penjualan atas nama karyawan ini pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.date)), csv: (r) => s(r.date) },
      { label: 'Transaksi', render: (r) => n(r.transactions), csv: (r) => n(r.transactions), align: 'right' },
      { label: 'Omzet', render: (r) => formatCurrency(n(r.revenue)), csv: (r) => n(r.revenue), align: 'right' },
      { label: 'Rata-rata', render: (r) => formatCurrency(n(r.average)), csv: (r) => n(r.average), align: 'right' },
      { label: 'Dibatalkan', render: (r) => n(r.voided), csv: (r) => n(r.voided), align: 'right' },
    ],
  },
  {
    key: 'cashshift',
    label: 'Kas Shift',
    empty: 'Belum ada shift kasir pada periode ini',
    columns: [
      { label: 'Tanggal', render: (r) => formatDate(s(r.shift_date)), csv: (r) => s(r.shift_date) },
      { label: 'Kas Awal', render: (r) => formatCurrency(n(r.opening_cash)), csv: (r) => n(r.opening_cash), align: 'right' },
      { label: 'Kas Akhir', render: (r) => formatCurrency(n(r.closing_cash)), csv: (r) => n(r.closing_cash), align: 'right' },
      { label: 'Seharusnya', render: (r) => formatCurrency(n(r.expected_closing_cash)), csv: (r) => n(r.expected_closing_cash), align: 'right' },
      {
        label: 'Selisih',
        render: (r) => <span className={n(r.cash_variance) === 0 ? 'text-gray-700' : 'font-semibold text-red-600'}>{formatCurrency(n(r.cash_variance))}</span>,
        csv: (r) => n(r.cash_variance),
        align: 'right',
      },
      { label: 'Rekonsiliasi', render: (r) => (r.reconciled ? 'Sudah' : 'Belum'), csv: (r) => (r.reconciled ? 'Sudah' : 'Belum') },
    ],
  },
]

interface Staff {
  outlet_id: string
  first_name: string
  last_name: string | null
  position: string
  status: string
  employment_status: string | null
  hire_date: string
  email: string | null
  phone: string | null
  salary_amount: number | null
  salary_frequency: string | null
  commission_rate: number
}

interface Summary {
  attendance_days: number
  absent_days: number
  late_days: number
  late_minutes: number
  worked_minutes: number
  leave_days: { izin: number; sakit: number; libur: number; cuti: number }
  pending_leave_requests: number
  checklist_completed: number
  net_pay_total: number
  payslip_count: number
  sales_revenue: number
  sales_transactions: number
  voided_transactions: number
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </Card>
  )
}

export function EmployeeProfile({ staffId, canManage = false }: { staffId: string; canManage?: boolean }) {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState<DateRange>(() => defaultDateRange(30))
  const [staff, setStaff] = useState<Staff | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [linked, setLinked] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [totalLate, setTotalLate] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/staff/${staffId}/history?type=${tab === 'kasbon' ? 'overview' : tab}&start=${range.start}&end=${range.end}`)
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal memuat riwayat')
        return
      }
      setStaff(data.staff)
      if (tab === 'overview' || tab === 'kasbon') {
        setSummary(data.summary)
        setLinked(data.linked_user)
      } else {
        setRows(data.rows ?? [])
        setTotalLate(data.total_late_minutes ?? 0)
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setIsLoading(false)
    }
  }, [staffId, tab, range])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const active = TABS.find((t) => t.key === tab)!
  const csvRows = useMemo(() => (active.columns ? rows.map((r) => Object.fromEntries(active.columns!.map((c) => [c.label, c.csv(r)]))) : []), [active, rows])

  const fullName = staff ? `${staff.first_name} ${staff.last_name ?? ''}`.trim() : 'Karyawan'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/staff" className="text-sm text-brand-600 hover:underline">
          ← Daftar Karyawan
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{fullName}</h1>
        {staff && (
          <p className="text-gray-500">
            {staff.position} · {staff.employment_status ?? '-'} · bergabung {formatDate(staff.hire_date)} ({tenureLabel(staff.hire_date)}) ·{' '}
            {staff.status === 'active' ? 'Aktif' : staff.status}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab !== 'kasbon' && <DateRangePicker value={range} onChange={setRange} />}
          {active.columns && <ExportCsvButton filename={`karyawan-${active.key}`} rows={csvRows} />}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {tab === 'kasbon' ? (
        staff ? <KasbonPanel staffId={staffId} outletId={staff.outlet_id} canManage={canManage} /> : <p className="text-gray-400">Memuat…</p>
      ) : tab === 'overview' ? (
        isLoading || !summary || !staff ? (
          <p className="text-gray-400">Memuat…</p>
        ) : (
          <div className="space-y-4">
            {!linked && (
              <Alert variant="warning">
                Karyawan ini belum terhubung ke akun pengguna, sehingga riwayat cuti, ceklis, dan penjualan tidak dapat ditampilkan. Isi email yang sama dengan
                akun pengguna untuk menghubungkannya.
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Hari Hadir" value={String(summary.attendance_days)} hint={`${summary.absent_days} hari absen`} />
              <Kpi label="Terlambat" value={`${summary.late_days} hari`} hint={summary.late_minutes ? formatDuration(summary.late_minutes) : 'Tidak ada'} />
              <Kpi label="Total Jam Kerja" value={formatDuration(summary.worked_minutes)} />
              <Kpi label="Ceklis Selesai" value={String(summary.checklist_completed)} />
              <Kpi label="Cuti" value={`${summary.leave_days.cuti} hari`} />
              <Kpi label="Sakit" value={`${summary.leave_days.sakit} hari`} />
              <Kpi label="Izin" value={`${summary.leave_days.izin} hari`} />
              <Kpi label="Libur" value={`${summary.leave_days.libur} hari`} hint={summary.pending_leave_requests ? `${summary.pending_leave_requests} menunggu persetujuan` : undefined} />
              <Kpi label="Gaji Bersih Dibayar" value={formatCurrency(summary.net_pay_total)} hint={`${summary.payslip_count} slip gaji`} />
              <Kpi label="Omzet Penjualan" value={formatCurrency(summary.sales_revenue)} hint={`${summary.sales_transactions} transaksi`} />
              <Kpi label="Transaksi Dibatalkan" value={String(summary.voided_transactions)} />
              <Kpi
                label="Gaji Pokok"
                value={staff.salary_amount ? formatCurrency(staff.salary_amount) : '-'}
                hint={`${staff.salary_frequency ?? ''}${staff.commission_rate ? ` · komisi ${Math.round(staff.commission_rate * 100)}%` : ''}`}
              />
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {tab === 'late' && !isLoading && rows.length > 0 && (
            <p className="text-sm text-gray-600">
              Total keterlambatan: <span className="font-bold text-gray-900">{formatDuration(totalLate)}</span> dalam {rows.length} hari
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {active.columns!.map((c) => (
                    <th key={c.label} className={`px-4 py-2 font-semibold text-gray-600 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={active.columns!.length} className="px-4 py-6 text-center text-gray-400">
                      Memuat…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={active.columns!.length} className="px-4 py-6 text-center text-gray-400">
                      {active.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={String(r.id ?? r.date ?? i)} className="hover:bg-gray-50">
                      {active.columns!.map((c) => (
                        <td key={c.label} className={`px-4 py-2 text-gray-700 ${c.align === 'right' ? 'text-right' : ''}`}>
                          {c.render(r)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
