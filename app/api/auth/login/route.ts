import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validate, loginSchema } from '@/lib/utils/validation'
import { checkRateLimit, clientIp } from '@/lib/utils/rateLimit'

const MAX_FAILED_ATTEMPTS = 3
const LOCKOUT_MINUTES = 15
// Per-IP, on top of the per-account lockout above — that alone doesn't stop
// credential stuffing spread across many different email addresses from the
// same source.
const IP_RATE_LIMIT = 10
const IP_RATE_WINDOW_SECONDS = 300

// POST /api/auth/login — see prd.md §4.1. Session is set via httpOnly
// cookies by the Supabase server client; the JSON body mirrors the PRD's
// documented response shape for API consumers (e.g. a future mobile app).
//
// Login lockout (design-system.md: "3 percobaan gagal -> kunci 15 menit"):
// tracked per-account via users.failed_login_attempts/locked_until, checked
// with the admin client BEFORE calling signInWithPassword (an unauthenticated
// request can't read its own users row under RLS yet) so a locked account
// never even reaches the real auth call. The "+ email keamanan" half of that
// original spec is NOT implemented — there's no email-sending
// infrastructure anywhere in this codebase to send it with.
export async function POST(request: NextRequest) {
  const ipLimit = await checkRateLimit(`login:${clientIp(request)}`, IP_RATE_LIMIT, IP_RATE_WINDOW_SECONDS)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil((ipLimit.retryAfterSeconds ?? 60) / 60)} menit.` },
      { status: 429 }
    )
  }

  const body = await request.json()
  const result = validate(loginSchema, body)
  if (!result.valid) {
    return NextResponse.json({ error: result.errors }, { status: 400 })
  }
  const { email, password } = result.data

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('users')
    .select('id, failed_login_attempts, locked_until')
    .eq('email', email)
    .maybeSingle()

  if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(existing.locked_until).getTime() - Date.now()) / 60_000)
    return NextResponse.json(
      { error: `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.` },
      { status: 423 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    if (existing) {
      const attempts = existing.failed_login_attempts + 1
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        await admin.from('users').update({ failed_login_attempts: attempts, locked_until: lockedUntil }).eq('id', existing.id)
        return NextResponse.json(
          { error: `Terlalu banyak percobaan gagal. Akun dikunci selama ${LOCKOUT_MINUTES} menit.` },
          { status: 423 }
        )
      }
      await admin.from('users').update({ failed_login_attempts: attempts }).eq('id', existing.id)
    }
    return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, role, company_id, outlet_id, status')
    .eq('id', data.user.id)
    .single()

  if (profile?.status === 'suspended') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan' }, { status: 403 })
  }

  await admin
    .from('users')
    .update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('id', data.user.id)

  return NextResponse.json({
    user: profile,
    expires_in: data.session.expires_in,
  })
}
