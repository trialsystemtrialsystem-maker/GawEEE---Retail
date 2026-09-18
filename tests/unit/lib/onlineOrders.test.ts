import { canTransition } from '@/lib/utils/onlineOrders'

describe('canTransition', () => {
  it('allows the normal forward flow: incoming -> on_process -> on_delivery -> completed', () => {
    expect(canTransition('incoming', 'on_process')).toBe(true)
    expect(canTransition('on_process', 'on_delivery')).toBe(true)
    expect(canTransition('on_delivery', 'completed')).toBe(true)
  })

  it('allows cancelling from any non-terminal status', () => {
    expect(canTransition('incoming', 'cancelled')).toBe(true)
    expect(canTransition('on_process', 'cancelled')).toBe(true)
    expect(canTransition('on_delivery', 'cancelled')).toBe(true)
  })

  it('rejects skipping a step', () => {
    expect(canTransition('incoming', 'on_delivery')).toBe(false)
    expect(canTransition('incoming', 'completed')).toBe(false)
    expect(canTransition('on_process', 'completed')).toBe(false)
  })

  it('rejects moving backward', () => {
    expect(canTransition('on_process', 'incoming')).toBe(false)
    expect(canTransition('on_delivery', 'on_process')).toBe(false)
  })

  it('rejects any transition out of a terminal status', () => {
    expect(canTransition('completed', 'on_delivery')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('cancelled', 'incoming')).toBe(false)
  })
})
