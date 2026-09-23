import { resolveOutletScope } from '@/lib/utils/outletScope'
import type { AuthContext } from '@/lib/utils/auth-context'

// Fakes the one Supabase call resolveOutletScope makes (the master_admin +
// "all" branch: .from('outlets').select('id').eq('company_id', ...)) —
// every other branch is pure and never touches auth.supabase at all.
function fakeSupabase(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(result),
      }),
    }),
  } as unknown as AuthContext['supabase']
}

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

describe('resolveOutletScope', () => {
  describe('outlet_id=all', () => {
    it('master_admin: resolves to every outlet in the company', async () => {
      const ctx = makeCtx({
        role: 'master_admin',
        outlet_id: null,
        supabase: fakeSupabase({ data: [{ id: 'outlet-1' }, { id: 'outlet-2' }, { id: 'outlet-3' }], error: null }),
      })
      const result = await resolveOutletScope(ctx, 'all')
      expect(result).toEqual({ scope: { outletIds: ['outlet-1', 'outlet-2', 'outlet-3'], isAll: true }, error: null, status: 200 })
    })

    it('master_admin: an empty company outlet list resolves to an empty scope, not an error', async () => {
      const ctx = makeCtx({ role: 'master_admin', outlet_id: null, supabase: fakeSupabase({ data: [], error: null }) })
      const result = await resolveOutletScope(ctx, 'all')
      expect(result).toEqual({ scope: { outletIds: [], isAll: true }, error: null, status: 200 })
    })

    it('master_admin: a database error surfaces as a 500', async () => {
      const ctx = makeCtx({ role: 'master_admin', outlet_id: null, supabase: fakeSupabase({ data: null, error: { message: 'connection reset' } }) })
      const result = await resolveOutletScope(ctx, 'all')
      expect(result).toEqual({ scope: null, error: 'connection reset', status: 500 })
    })

    it('non-master_admin: resolves to just their own outlet, no query needed', async () => {
      const ctx = makeCtx({ role: 'cashier', outlet_id: 'outlet-1' })
      const result = await resolveOutletScope(ctx, 'all')
      expect(result).toEqual({ scope: { outletIds: ['outlet-1'], isAll: true }, error: null, status: 200 })
    })

    it('non-master_admin with no outlet assigned: 400, not a crash', async () => {
      const ctx = makeCtx({ role: 'cashier', outlet_id: null })
      const result = await resolveOutletScope(ctx, 'all')
      expect(result).toEqual({ scope: null, error: 'Pilih outlet terlebih dahulu', status: 400 })
    })
  })

  describe('a specific outlet_id', () => {
    it('own outlet: allowed', async () => {
      const ctx = makeCtx({ role: 'cashier', outlet_id: 'outlet-1' })
      const result = await resolveOutletScope(ctx, 'outlet-1')
      expect(result).toEqual({ scope: { outletIds: ['outlet-1'], isAll: false }, error: null, status: 200 })
    })

    it("a different outlet, non-master_admin: 403", async () => {
      const ctx = makeCtx({ role: 'outlet_manager', outlet_id: 'outlet-1' })
      const result = await resolveOutletScope(ctx, 'outlet-2')
      expect(result).toEqual({ scope: null, error: 'Tidak memiliki izin', status: 403 })
    })

    it('a different outlet, master_admin: allowed', async () => {
      const ctx = makeCtx({ role: 'master_admin', outlet_id: 'outlet-1' })
      const result = await resolveOutletScope(ctx, 'outlet-99')
      expect(result).toEqual({ scope: { outletIds: ['outlet-99'], isAll: false }, error: null, status: 200 })
    })
  })

  describe('no outlet_id param (backward compatibility)', () => {
    it('defaults to the caller\'s own outlet', async () => {
      const ctx = makeCtx({ role: 'cashier', outlet_id: 'outlet-1' })
      const result = await resolveOutletScope(ctx, null)
      expect(result).toEqual({ scope: { outletIds: ['outlet-1'], isAll: false }, error: null, status: 200 })
    })

    it('400 if the caller has no outlet of their own either', async () => {
      const ctx = makeCtx({ role: 'master_admin', outlet_id: null })
      const result = await resolveOutletScope(ctx, null)
      expect(result).toEqual({ scope: null, error: 'Pilih outlet terlebih dahulu', status: 400 })
    })
  })
})
