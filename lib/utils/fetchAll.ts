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
