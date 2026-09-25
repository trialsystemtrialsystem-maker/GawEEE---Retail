// Supabase/PostgREST returns at most 1000 rows per request, silently. Anything
// that aggregates in application code (stock valuation, sales velocity) must
// page through the whole result or it under-counts on a busy outlet.
export async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, pageSize = 1000, maxPages = 50): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await build(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return all
}

// Drop-in for `await query` when the result can exceed PostgREST's silent
// 1000-row cap and is aggregated in JS (journal lines, invoices, ledger…). Pass
// the un-awaited query builder; it is paged with .range() after adding a
// primary-key tie-break order so pages never overlap or skip. Returns the same
// { data, error } shape, with the row type preserved.
export async function selectAll<Q extends { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> }>(
  query: Q,
  pageSize = 1000,
  maxPages = 100
): Promise<{ data: NonNullable<Awaited<ReturnType<Q['range']>>['data']> | null; error: Awaited<ReturnType<Q['range']>>['error'] }> {
  type Res = Awaited<ReturnType<Q['range']>>
  const ordered = (query as unknown as { order: (col: string) => Q }).order('id')
  const all: unknown[] = []
  for (let page = 0; page < maxPages; page++) {
    const res = (await ordered.range(page * pageSize, page * pageSize + pageSize - 1)) as Res
    if (res.error) return { data: null, error: res.error }
    const rows = (res.data ?? []) as unknown[]
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return { data: all as NonNullable<Res['data']>, error: null as Res['error'] }
}
