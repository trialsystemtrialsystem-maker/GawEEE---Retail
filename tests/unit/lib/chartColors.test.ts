import { colorForIndex, CHART_SLOTS } from '@/lib/utils/chartColors'

describe('colorForIndex', () => {
  it('returns the matching slot for indices within range', () => {
    expect(colorForIndex(0)).toBe(CHART_SLOTS[0])
    expect(colorForIndex(3)).toBe(CHART_SLOTS[3])
    expect(colorForIndex(CHART_SLOTS.length - 1)).toBe(CHART_SLOTS[CHART_SLOTS.length - 1])
  })

  it('wraps around past the end of the palette instead of returning undefined', () => {
    expect(colorForIndex(CHART_SLOTS.length)).toBe(CHART_SLOTS[0])
    expect(colorForIndex(CHART_SLOTS.length + 2)).toBe(CHART_SLOTS[2])
  })

  it('is stable — the same index always maps to the same color', () => {
    const index = 5
    expect(colorForIndex(index)).toBe(colorForIndex(index))
  })
})
