// Pure helpers for the Employee 360 history views (todo.md Phase 33) — split
// out from the API route so the time math is unit-testable.

// Indonesia (Asia/Jakarta, WIB) has no DST, so a fixed +07:00 offset is exact;
// shifts.start_time is a wall-clock `time` (no zone) while attendance
// timestamps are UTC timestamptz, so comparing them needs this conversion.
const JAKARTA_OFFSET_MINUTES = 7 * 60

function localMinutesOfDay(iso: string, offsetMinutes = JAKARTA_OFFSET_MINUTES): number {
  const d = new Date(iso)
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  return (utcMinutes + offsetMinutes + 24 * 60) % (24 * 60)
}

/** Minutes a clock-in was after the scheduled shift start (0 if on time or
 * early). `shiftStart` is a Postgres `time` string like "08:00:00". */
export function lateMinutes(clockInIso: string | null, shiftStart: string | null, offsetMinutes = JAKARTA_OFFSET_MINUTES): number {
  if (!clockInIso || !shiftStart) return 0
  const [h, m] = shiftStart.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return Math.max(0, localMinutesOfDay(clockInIso, offsetMinutes) - (h * 60 + m))
}

/** Whole minutes between clock-in and clock-out; 0 if either is missing or
 * the range is inverted. */
export function workedMinutes(clockInIso: string | null, clockOutIso: string | null): number {
  if (!clockInIso || !clockOutIso) return 0
  return Math.max(0, Math.round((Date.parse(clockOutIso) - Date.parse(clockInIso)) / 60000))
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`
}

/** Inclusive number of calendar days a leave request covers within
 * [rangeStart, rangeEnd] (all YYYY-MM-DD, compared as UTC dates). */
export function leaveDaysWithin(start: string, end: string, rangeStart: string, rangeEnd: string): number {
  const s = Math.max(Date.parse(`${start}T00:00:00Z`), Date.parse(`${rangeStart}T00:00:00Z`))
  const e = Math.min(Date.parse(`${end}T00:00:00Z`), Date.parse(`${rangeEnd}T00:00:00Z`))
  return e < s ? 0 : Math.round((e - s) / 86_400_000) + 1
}

/** Tenure as "X tahun Y bulan" from a hire date to today. */
export function tenureLabel(hireDate: string, today = new Date()): string {
  const hire = new Date(`${hireDate}T00:00:00Z`)
  let months = (today.getUTCFullYear() - hire.getUTCFullYear()) * 12 + (today.getUTCMonth() - hire.getUTCMonth())
  if (today.getUTCDate() < hire.getUTCDate()) months -= 1
  months = Math.max(0, months)
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years > 0) return `${years} tahun ${rest} bulan`
  return `${rest} bulan`
}

/** Minutes worked past the scheduled shift end (0 if left on time/early).
 * `shiftEnd` is a Postgres `time` string; overnight shifts (end earlier than
 * start) are treated as ending the next day by the caller's schedule, so this
 * only handles same-day shifts and returns 0 when it cannot tell. */
export function overtimeMinutes(clockOutIso: string | null, shiftEnd: string | null, offsetMinutes = JAKARTA_OFFSET_MINUTES): number {
  if (!clockOutIso || !shiftEnd) return 0
  const [h, m] = shiftEnd.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return Math.max(0, localMinutesOfDay(clockOutIso, offsetMinutes) - (h * 60 + m))
}
