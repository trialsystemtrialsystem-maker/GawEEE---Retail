import { createAdminClient } from '@/lib/supabase/server'

export type RateLimitDecision =
  | { action: 'allow_new'; nowIso: string }
  | { action: 'allow_reset'; nowIso: string }
  | { action: 'deny'; retryAfterSeconds: number }
  | { action: 'allow_increment' }

/** Pure decision logic, split out from the DB read/write in checkRateLimit()
 * below so it's unit-testable without a Supabase client. `existing` is the
 * current row for this key, or null if there isn't one yet. */
export function evaluateRateLimit(
  existing: { count: number; window_start: string } | null,
  now: number,
  maxRequests: number,
  windowSeconds: number
): RateLimitDecision {
  if (!existing) {
    return { action: 'allow_new', nowIso: new Date(now).toISOString() }
  }

  const windowStart = new Date(existing.window_start).getTime()
  const elapsedSeconds = (now - windowStart) / 1000

  if (elapsedSeconds > windowSeconds) {
    return { action: 'allow_reset', nowIso: new Date(now).toISOString() }
  }

  if (existing.count >= maxRequests) {
    return { action: 'deny', retryAfterSeconds: Math.ceil(windowSeconds - elapsedSeconds) }
  }

  return { action: 'allow_increment' }
}

/** DB-backed fixed-window rate limiter (see 061_rate_limits.sql for why not
 * in-memory). `key` should already include the route, e.g. `login:<ip>` —
 * this function doesn't scope by caller. Read-then-write, not atomic: an
 * acceptable trade-off for abuse protection (not a correctness-critical
 * count) at this scale, matching other documented trade-offs in this app
 * (e.g. the demo seed route's background-reseed design). */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const admin = createAdminClient()
  const { data: existing } = await admin.from('api_rate_limits').select('count, window_start').eq('key', key).maybeSingle()

  const decision = evaluateRateLimit(existing, Date.now(), maxRequests, windowSeconds)

  switch (decision.action) {
    case 'allow_new':
      await admin.from('api_rate_limits').upsert({ key, count: 1, window_start: decision.nowIso })
      return { allowed: true }
    case 'allow_reset':
      await admin.from('api_rate_limits').update({ count: 1, window_start: decision.nowIso }).eq('key', key)
      return { allowed: true }
    case 'allow_increment':
      await admin.from('api_rate_limits').update({ count: existing!.count + 1 }).eq('key', key)
      return { allowed: true }
    case 'deny':
      return { allowed: false, retryAfterSeconds: decision.retryAfterSeconds }
  }
}

/** Best-effort client IP from Vercel/proxy headers, falling back to a
 * constant so rate limiting degrades to "shared across all unknown-IP
 * callers" rather than throwing when nothing is present (e.g. local dev
 * without a proxy in front). */
export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
