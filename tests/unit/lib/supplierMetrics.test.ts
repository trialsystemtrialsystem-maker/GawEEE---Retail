import { deliveryStats, priceTrends } from '@/lib/utils/supplierMetrics'

describe('deliveryStats', () => {
  it('computes lead time and on-time rate over delivered POs only', () => {
    const r = deliveryStats([
      { order_date: '2026-01-01', requested_delivery_date: '2026-01-05', actual_delivery_date: '2026-01-04' }, // 3d, on time
      { order_date: '2026-01-10', requested_delivery_date: '2026-01-12', actual_delivery_date: '2026-01-15' }, // 5d, late
      { order_date: '2026-01-20', requested_delivery_date: '2026-01-25', actual_delivery_date: null }, // not delivered
    ])
    expect(r.delivered).toBe(2)
    expect(r.avg_lead_days).toBe(4)
    expect(r.on_time_rate).toBe(0.5)
    expect(r.late_count).toBe(1)
  })
  it('is null-safe with nothing delivered or no requested dates', () => {
    expect(deliveryStats([])).toEqual({ delivered: 0, avg_lead_days: null, on_time_rate: null, late_count: 0 })
    const r = deliveryStats([{ order_date: '2026-02-01', requested_delivery_date: null, actual_delivery_date: '2026-02-03' }])
    expect(r.on_time_rate).toBeNull()
    expect(r.avg_lead_days).toBe(2)
  })
})

describe('priceTrends', () => {
  it('reports first/last/min/max and the change since the first purchase', () => {
    const [t] = priceTrends([
      { product_id: 'p', date: '2026-03-01', unit_cost: 120 },
      { product_id: 'p', date: '2026-01-01', unit_cost: 100 },
      { product_id: 'p', date: '2026-02-01', unit_cost: 90 },
    ])
    expect(t).toMatchObject({ first: 100, last: 120, min: 90, max: 120, purchases: 3 })
    expect(t.change_pct).toBeCloseTo(0.2)
  })
  it('groups by product and handles a zero first price', () => {
    const r = priceTrends([
      { product_id: 'a', date: '2026-01-01', unit_cost: 0 },
      { product_id: 'a', date: '2026-02-01', unit_cost: 5 },
      { product_id: 'b', date: '2026-01-01', unit_cost: 10 },
    ])
    expect(r).toHaveLength(2)
    expect(r.find((x) => x.product_id === 'a')?.change_pct).toBeNull()
  })
})
