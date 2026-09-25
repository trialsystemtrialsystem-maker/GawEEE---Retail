import { resolveActiveOutletId } from '@/lib/server/activeOutlet'

let cookieValue: string | undefined
jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }) }))

const client = (ids: string[]) =>
  ({ from: () => ({ select: () => ({ order: async () => ({ data: ids.map((id) => ({ id })) }) }) }) }) as unknown as Parameters<typeof resolveActiveOutletId>[0]

describe('resolveActiveOutletId', () => {
  beforeEach(() => {
    cookieValue = undefined
  })
  it('gives non-owners exactly their own outlet, ignoring the cookie', async () => {
    cookieValue = 'b'
    expect(await resolveActiveOutletId(client(['a', 'b']), { outlet_id: 'own', role: 'outlet_manager' })).toBe('own')
    expect(await resolveActiveOutletId(client(['a']), { outlet_id: null, role: 'cashier' })).toBeNull()
  })
  it('defaults an owner to their own outlet, else the first', async () => {
    expect(await resolveActiveOutletId(client(['a', 'b']), { outlet_id: 'b', role: 'master_admin' })).toBe('b')
    expect(await resolveActiveOutletId(client(['a', 'b']), { outlet_id: null, role: 'master_admin' })).toBe('a')
  })
  it('honours the owner\'s chosen outlet only if it is one of theirs', async () => {
    cookieValue = 'b'
    expect(await resolveActiveOutletId(client(['a', 'b']), { outlet_id: 'a', role: 'master_admin' })).toBe('b')
    cookieValue = 'someone-elses'
    expect(await resolveActiveOutletId(client(['a', 'b']), { outlet_id: null, role: 'master_admin' })).toBe('a')
  })
  it('falls back to the profile outlet when the company list is empty', async () => {
    expect(await resolveActiveOutletId(client([]), { outlet_id: null, role: 'master_admin' })).toBeNull()
  })
})
