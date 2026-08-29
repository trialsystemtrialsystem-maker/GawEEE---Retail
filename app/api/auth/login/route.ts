import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validate, loginSchema } from '@/lib/utils/validation'

// POST /api/auth/login — see prd.md §4.1. Session is set via httpOnly
// cookies by the Supabase server client; the JSON body mirrors the PRD's
// documented response shape for API consumers (e.g. a future mobile app).
export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = validate(loginSchema, body)
  if (!result.valid) {
    return NextResponse.json({ error: result.errors }, { status: 400 })
  }
  const { email, password } = result.data

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
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

  return NextResponse.json({
    user: profile,
    expires_in: data.session.expires_in,
  })
}
