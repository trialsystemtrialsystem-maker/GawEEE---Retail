import { selectAll, fetchAllRows } from '@/lib/utils/fetchAll'

// A fake PostgREST builder over an in-memory table: order() is recorded, range()
// returns the slice (capped like the real server) so paging logic is exercised.
function fakeQuery(total: number, opts: { failAtPage?: number } = {}) {
  const calls: { order: string[]; ranges: [number, number][] } = { order: [], ranges: [] }
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }))
  const q = {
    order(col: string) {
      calls.order.push(col)
      return q
    },
    range(from: number, to: number) {
      calls.ranges.push([from, to])
      if (opts.failAtPage !== undefined && calls.ranges.length - 1 === opts.failAtPage) return Promise.resolve({ data: null, error: { message: 'boom' } })
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
    },
  }
  return { q, calls }
}

describe('selectAll', () => {
  it('reads every page past the 1000-row cap, in order, without gaps', async () => {
    const { q, calls } = fakeQuery(2350)
    const { data, error } = await selectAll(q)
    expect(error).toBeNull()
    expect(data).toHaveLength(2350)
    expect(data?.[0]).toEqual({ id: 1 })
    expect(data?.[2349]).toEqual({ id: 2350 })
    expect(calls.order).toEqual(['id'])
    expect(calls.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it('stops after a short page and handles an exact multiple', async () => {
    expect((await selectAll(fakeQuery(10).q)).data).toHaveLength(10)
    const exact = fakeQuery(2000)
    expect((await selectAll(exact.q)).data).toHaveLength(2000)
    expect(exact.calls.ranges).toHaveLength(3) // the empty third page confirms the end
  })
  it('returns the error and no partial data', async () => {
    const { data, error } = await selectAll(fakeQuery(3000, { failAtPage: 1 }).q)
    expect(data).toBeNull()
    expect(error).toEqual({ message: 'boom' })
  })
})

describe('fetchAllRows', () => {
  it('pages a builder-factory and throws on error', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => i)
    const all = await fetchAllRows<number>(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(all).toHaveLength(1500)
    await expect(fetchAllRows<number>(async () => ({ data: null, error: { message: 'x' } }))).rejects.toEqual({ message: 'x' })
  })
})
