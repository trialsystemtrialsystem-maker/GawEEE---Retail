import { summarize, bucketKey, trend, deltaPct, previousRange, rankLines, topCustomers, type SaleInvoice } from '@/lib/utils/salesSummary'

function inv(over: Partial<SaleInvoice> & { id: string }): SaleInvoice {
  return {
    created_at: '2026-06-10T03:00:00.000Z',
    subtotal: 100_000,
    discount_amount: 0,
    tax_amount: 0,
    total: 100_000,
    payment_status: 'paid',
    order_status: 'completed',
    cashier_id: 'c1',
    customer_key: null,
    customer_name: null,
    lines: [{ product_id: 'p1', name: 'Kopi', category: 'Minuman', quantity: 2, subtotal: 100_000, cogs: 60_000 }],
    ...over,
  }
}

describe('summarize', () => {
  it('totals completed sales, counts voids separately, computes margin', () => {
    const t = summarize([
      inv({ id: 'a' }),
      inv({ id: 'b', subtotal: 50_000, discount_amount: 5_000, tax_amount: 4_950, total: 49_950, payment_status: 'pending', lines: [{ product_id: 'p2', name: 'Teh', category: 'Minuman', quantity: 1, subtotal: 50_000, cogs: null }] }),
      inv({ id: 'v', order_status: 'voided', total: 999 }),
    ])
    expect(t.invoice_count).toBe(2)
    expect(t.gross).toBe(150_000)
    expect(t.discount).toBe(5_000)
    expect(t.net).toBe(145_000)
    expect(t.total).toBe(149_950)
    expect(t.items_sold).toBe(3)
    expect(t.unpaid_count).toBe(1)
    expect(t.void_count).toBe(1)
    expect(t.void_total).toBe(999)
    expect(t.gross_profit).toBe(40_000) // only the costed line
    expect(t.margin_pct).toBeCloseTo(40)
    expect(t.cost_coverage_pct).toBeCloseTo(66.67, 1)
    expect(t.avg_basket).toBeCloseTo(74_975)
  })

  it('has null margin with no cost data and zeros when empty', () => {
    expect(summarize([]).invoice_count).toBe(0)
    expect(summarize([inv({ id: 'a', lines: [{ product_id: 'p', name: 'x', category: 'y', quantity: 1, subtotal: 1, cogs: null }] })]).margin_pct).toBeNull()
  })
})

describe('buckets and trend', () => {
  it('buckets by day, ISO week (Monday) and month', () => {
    expect(bucketKey('2026-06-10T03:00:00.000Z', 'day')).toBe('2026-06-10')
    expect(bucketKey('2026-06-10T03:00:00.000Z', 'month')).toBe('2026-06')
    expect(bucketKey('2026-06-10T03:00:00.000Z', 'week')).toBe('2026-06-08') // Wednesday -> Monday
    expect(bucketKey('2026-06-14T23:00:00.000Z', 'week')).toBe('2026-06-08') // Sunday stays in that week
  })
  it('sums per bucket in order and skips voids', () => {
    const t = trend([inv({ id: 'a', created_at: '2026-06-11T01:00:00.000Z' }), inv({ id: 'b', created_at: '2026-06-10T01:00:00.000Z' }), inv({ id: 'c', created_at: '2026-06-10T05:00:00.000Z', order_status: 'voided' }), inv({ id: 'd', created_at: '2026-06-10T09:00:00.000Z' })], 'day')
    expect(t).toEqual([{ key: '2026-06-10', total: 200_000, count: 2 }, { key: '2026-06-11', total: 100_000, count: 1 }])
  })
})

describe('comparison', () => {
  it('computes percent change, null without a base', () => {
    expect(deltaPct(150, 100)).toBe(50)
    expect(deltaPct(50, 100)).toBe(-50)
    expect(deltaPct(10, 0)).toBeNull()
  })
  it('gives the equally long preceding range', () => {
    expect(previousRange('2026-06-08', '2026-06-14')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
    expect(previousRange('2026-03-01', '2026-03-01')).toEqual({ start: '2026-02-28', end: '2026-02-28' })
  })
})

describe('rankings', () => {
  const data = [
    inv({ id: 'a', customer_key: '0811', customer_name: 'Ani' }),
    inv({ id: 'b', customer_key: '0811', customer_name: 'Ani', lines: [{ product_id: 'p2', name: 'Teh', category: 'Minuman', quantity: 1, subtotal: 300_000, cogs: null }], total: 300_000 }),
    inv({ id: 'c', customer_key: '0822', customer_name: 'Budi' }),
  ]
  it('ranks products by revenue with profit only where cost is known', () => {
    const r = rankLines(data, (l) => ({ key: l.product_id, label: l.name }))
    expect(r.map((x) => x.label)).toEqual(['Teh', 'Kopi'])
    expect(r[0].profit).toBeNull()
    expect(r[1]).toMatchObject({ quantity: 4, revenue: 200_000, profit: 80_000, count: 2 })
  })
  it('ranks customers by spend', () => {
    expect(topCustomers(data).map((c) => [c.name, c.total, c.count])).toEqual([['Ani', 400_000, 2], ['Budi', 100_000, 1]])
  })
})
