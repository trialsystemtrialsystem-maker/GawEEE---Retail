/** Fixed categorical chart-color slots (dataviz skill) — same palette
 * `components/charts/CategoryBreakdownChart.tsx` uses, shared here so new
 * category-colored UI (product tiles, etc.) stays consistent with the
 * existing chart components rather than picking its own colors. */
export const CHART_SLOTS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

export function colorForIndex(index: number): string {
  return CHART_SLOTS[index % CHART_SLOTS.length]
}
