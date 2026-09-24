import { applyFeatureFlags, isFeatureEnabled } from '@/lib/nav/features'
import type { NavItem } from '@/lib/nav/config'

const nav: NavItem[] = [
  { key: 'sales', label: 'Sales', href: '/dashboard', icon: 'x' },
  { key: 'bookings', label: 'Bookings', href: '/dashboard/bookings', icon: 'x' },
]

describe('feature flags', () => {
  it('treats missing flags as enabled', () => {
    expect(isFeatureEnabled({}, 'bookings')).toBe(true)
    expect(isFeatureEnabled(undefined, 'bookings')).toBe(true)
    expect(applyFeatureFlags(nav, {}, false)).toHaveLength(2)
  })
  it('hides disabled modules for regular users', () => {
    expect(applyFeatureFlags(nav, { bookings: false }, false).map((i) => i.key)).toEqual(['sales'])
  })
  it('keeps disabled modules visible but marked for master_admin', () => {
    const r = applyFeatureFlags(nav, { bookings: false }, true)
    expect(r).toHaveLength(2)
    expect(r[1].disabled).toBe(true)
  })
  it('never hides modules that are not switchable via unknown keys', () => {
    expect(applyFeatureFlags(nav, { sales: true }, false)).toHaveLength(2)
  })
})
