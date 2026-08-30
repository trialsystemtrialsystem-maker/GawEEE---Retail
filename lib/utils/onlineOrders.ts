import type { OnlineOrderStatus } from '@/lib/types/database.types'

/** Allowed forward transitions for an online order — prevents e.g. jumping
 * straight from 'incoming' to 'completed'. Any non-terminal status may also
 * be cancelled. */
const ALLOWED_TRANSITIONS: Record<OnlineOrderStatus, OnlineOrderStatus[]> = {
  incoming: ['on_process', 'cancelled'],
  on_process: ['on_delivery', 'cancelled'],
  on_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: OnlineOrderStatus, to: OnlineOrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
