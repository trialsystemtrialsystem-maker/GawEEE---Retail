import { resolvePermission, PERMISSIONS, DEFAULT_PERMISSIONS } from '@/lib/utils/permissions'

describe('resolvePermission', () => {
  it('master_admin is always allowed, even against a hostile override', () => {
    expect(resolvePermission('master_admin', 'invoice.void', { master_admin: { 'invoice.void': false } })).toBe(true)
  })

  it('defaults match the pre-configurable behavior: manager yes, cashier/staff no', () => {
    for (const p of PERMISSIONS) {
      expect(resolvePermission('outlet_manager', p.key)).toBe(true)
      expect(resolvePermission('cashier', p.key)).toBe(false)
      expect(resolvePermission('staff', p.key)).toBe(false)
    }
  })

  it('a company override can grant a cashier a permission', () => {
    expect(resolvePermission('cashier', 'invoice.void', { cashier: { 'invoice.void': true } })).toBe(true)
  })

  it('a company override can revoke a manager permission', () => {
    expect(resolvePermission('outlet_manager', 'po.approve', { outlet_manager: { 'po.approve': false } })).toBe(false)
  })

  it('an override for one key does not affect another', () => {
    const overrides = { cashier: { 'invoice.void': true } }
    expect(resolvePermission('cashier', 'inventory.adjust', overrides)).toBe(false)
  })

  it('unknown roles and unknown keys are denied', () => {
    expect(resolvePermission('intern', 'invoice.void')).toBe(false)
    expect(resolvePermission('outlet_manager', 'nonexistent.key')).toBe(false)
  })

  it('ignores non-boolean override values', () => {
    expect(resolvePermission('cashier', 'invoice.void', { cashier: { 'invoice.void': 'yes' as unknown as boolean } })).toBe(false)
  })

  it('every editable role has an entry for every permission', () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS) as (keyof typeof DEFAULT_PERMISSIONS)[]) {
      for (const p of PERMISSIONS) expect(typeof DEFAULT_PERMISSIONS[role][p.key]).toBe('boolean')
    }
  })
})
