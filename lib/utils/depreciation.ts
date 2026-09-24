// Straight-line monthly depreciation (metode garis lurus). Pure, so the route,
// the UI and the tests agree. Months are identified by their first day
// (YYYY-MM-01). An asset depreciates from its acquisition month, one full month
// at a time, until the depreciable base (cost - salvage) is used up; the last
// month absorbs any rounding remainder so the total lands exactly on the base.

export interface AssetLike {
  cost: number
  salvage_value: number
  useful_life_months: number
  acquisition_date: string // YYYY-MM-DD
  status: string
}

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`

function monthIndex(monthStartDate: string): number {
  const [y, m] = monthStartDate.split('-').map(Number)
  return y * 12 + (m - 1)
}

/** How many depreciation months have elapsed for `month` (1-based): the
 * acquisition month is month 1. 0 or negative before acquisition. */
export function monthNumber(asset: AssetLike, month: string): number {
  return monthIndex(month) - monthIndex(monthStart(asset.acquisition_date)) + 1
}

export function depreciableBase(asset: AssetLike): number {
  return Math.max(0, asset.cost - asset.salvage_value)
}

/** Depreciation expense for `month`, given what was already booked. 0 when the
 * asset isn't active, hasn't been acquired yet, or is fully depreciated. */
export function depreciationForMonth(asset: AssetLike, month: string, alreadyDepreciated: number): number {
  if (asset.status !== 'active') return 0
  const n = monthNumber(asset, month)
  if (n < 1 || n > asset.useful_life_months) return 0
  const base = depreciableBase(asset)
  const remaining = Math.round((base - alreadyDepreciated) * 100) / 100
  if (remaining <= 0) return 0
  const monthly = Math.round((base / asset.useful_life_months) * 100) / 100
  return n === asset.useful_life_months ? remaining : Math.min(monthly, remaining)
}

export function bookValue(asset: AssetLike, accumulated: number): number {
  return Math.round((asset.cost - accumulated) * 100) / 100
}
