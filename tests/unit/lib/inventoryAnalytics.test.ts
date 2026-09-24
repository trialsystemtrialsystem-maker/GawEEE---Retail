import { abcClassify, daysOfCover, runningBalances, stockHealth, suggestedReorderQty } from '@/lib/utils/inventoryAnalytics'

describe('daysOfCover', () => {
  it('divides stock by daily pace and is null when nothing sells', () => {
    expect(daysOfCover(30, 3)).toBe(10)
    expect(daysOfCover(30, 0)).toBeNull()
  })
})

describe('suggestedReorderQty', () => {
  it('orders nothing when stock is healthy', () => {
    expect(suggestedReorderQty({ onHand: 100, reorderLevel: 10, reorderQuantity: 0, avgDailySales: 2 })).toBe(0)
  })
  it('orders to cover lead time + cover days when below the reorder level', () => {
    // pace 5/day, (7+14) days = 105 + level 10 = 115 target, have 8
    expect(suggestedReorderQty({ onHand: 8, reorderLevel: 10, reorderQuantity: 0, avgDailySales: 5 })).toBe(107)
  })
  it('honours the configured order quantity when larger', () => {
    expect(suggestedReorderQty({ onHand: 2, reorderLevel: 5, reorderQuantity: 200, avgDailySales: 1 })).toBe(200)
  })
  it('flags stock that will run out inside the lead time even above the level', () => {
    expect(suggestedReorderQty({ onHand: 20, reorderLevel: 5, reorderQuantity: 0, avgDailySales: 10 })).toBeGreaterThan(0)
  })
  it('orders at least 1 for an empty item with no history', () => {
    expect(suggestedReorderQty({ onHand: 0, reorderLevel: 0, reorderQuantity: 0, avgDailySales: 0 })).toBe(1)
  })
})

describe('abcClassify', () => {
  it('puts the top 80% of value in A, next 15% in B, rest in C', () => {
    const r = abcClassify([
      { id: 'a', value: 800 },
      { id: 'b', value: 150 },
      { id: 'c', value: 40 },
      { id: 'd', value: 10 },
      { id: 'z', value: 0 },
    ])
    expect(r.get('a')).toBe('A')
    expect(r.get('b')).toBe('B')
    expect(r.get('c')).toBe('C')
    expect(r.get('d')).toBe('C')
    expect(r.get('z')).toBe('C')
  })
  it('handles an all-zero list', () => {
    expect(abcClassify([{ id: 'x', value: 0 }]).get('x')).toBe('C')
  })
})

describe('stockHealth', () => {
  it('classifies empty, dead, slow and active stock', () => {
    expect(stockHealth(0, 5, 60)).toBe('empty')
    expect(stockHealth(10, 0, 60)).toBe('dead')
    expect(stockHealth(1000, 6, 60)).toBe('slow') // 0.1/day -> 10000 days
    expect(stockHealth(10, 60, 60)).toBe('active')
  })
})

describe('runningBalances', () => {
  it('derives each historical balance from the current stock', () => {
    // newest first: +5 (now 15), -3, +8  => before: 10 (after -3 was 10... check)
    const r = runningBalances([{ quantity_change: 5 }, { quantity_change: -3 }, { quantity_change: 8 }], 15)
    expect(r.map((x) => x.balance)).toEqual([15, 10, 13])
  })
})
