'use client'

// Reusable "from - to" date range picker for reports. Deliberately plain
// <input type="date"> values (YYYY-MM-DD strings) rather than JS Date
// objects passed around the app — every report API compares these directly
// against UTC boundaries (`${start}T00:00:00.000Z` / `${end}T23:59:59.999Z`),
// avoiding the local-timezone Date arithmetic that caused a real bug this
// session (see todo.md Phase 27/28: local Date construction silently
// shifted query boundaries by up to a day against the UTC-stored data).
export interface DateRange {
  start: string
  end: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function defaultDateRange(daysBack: number): DateRange {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - daysBack + 1)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const max = todayIso()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Dari:</label>
      <input
        type="date"
        value={value.start}
        max={value.end || max}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        className="rounded-sm border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
      />
      <label className="text-sm font-medium text-gray-700">Sampai:</label>
      <input
        type="date"
        value={value.end}
        min={value.start}
        max={max}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        className="rounded-sm border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
      />
    </div>
  )
}
