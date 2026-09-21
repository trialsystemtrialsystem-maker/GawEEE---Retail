/** Resolves a report's date-range query params into UTC-safe ISO boundary
 * strings, ready for direct `.gte()`/`.lte()` comparison against a
 * `timestamptz` column. Accepts either an explicit `start`/`end` (YYYY-MM-DD,
 * from a <DateRangePicker>) or falls back to the last `days` days ending
 * today — never local-timezone Date arithmetic, which is what caused a real
 * bug this session (see todo.md Phase 27/28): `new Date(y, m, d)`,
 * `.setDate()`, `.getDate()` etc. are all local-time and silently shift
 * query boundaries by up to a day against UTC-stored data wherever the
 * server's local timezone isn't UTC itself. Every boundary here is built by
 * string concatenation on a UTC-derived YYYY-MM-DD, so there's no local
 * timezone in the computation at all. */
export function resolveDateRange(searchParams: URLSearchParams, defaultDays = 30, maxDays = 366) {
  const explicitStart = searchParams.get('start')
  const explicitEnd = searchParams.get('end')
  const todayIso = new Date().toISOString().slice(0, 10)

  let startDate: string
  let endDate: string

  if (explicitStart && explicitEnd) {
    startDate = explicitStart
    endDate = explicitEnd
  } else {
    const days = Math.min(Number(searchParams.get('days') ?? String(defaultDays)), maxDays)
    endDate = todayIso
    const end = new Date(`${todayIso}T00:00:00.000Z`)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - days + 1)
    startDate = start.toISOString().slice(0, 10)
  }

  return {
    startDate,
    endDate,
    startIso: `${startDate}T00:00:00.000Z`,
    endIso: `${endDate}T23:59:59.999Z`,
  }
}
