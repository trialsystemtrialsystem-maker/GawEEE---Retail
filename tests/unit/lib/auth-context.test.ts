import { canAccessOutlet, type AuthContext } from '@/lib/utils/auth-context'

function makeCtx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    supabase: {} as AuthContext['supabase'],
    authUserId: 'user-1',
    id: 'user-1',
    company_id: 'company-1',
    outlet_id: 'outlet-1',
    role: 'cashier',
    status: 'active',
    ...overrides,
  }
}

describe('canAccessOutlet', () => {
  it('allows a staff user to access their own outlet', () => {
    const ctx = makeCtx({ role: 'cashier', outlet_id: 'outlet-1' })
    expect(canAccessOutlet(ctx, 'outlet-1')).toBe(true)
  })

  it('denies a staff user access to a different outlet', () => {
    const ctx = makeCtx({ role: 'cashier', outlet_id: 'outlet-1' })
    expect(canAccessOutlet(ctx, 'outlet-2')).toBe(false)
  })

  it('allows a master_admin to access any outlet', () => {
    const ctx = makeCtx({ role: 'master_admin', outlet_id: 'outlet-1' })
    expect(canAccessOutlet(ctx, 'outlet-99')).toBe(true)
  })

  it('denies an outlet_manager access to a different outlet', () => {
    const ctx = makeCtx({ role: 'outlet_manager', outlet_id: 'outlet-1' })
    expect(canAccessOutlet(ctx, 'outlet-2')).toBe(false)
  })
})
