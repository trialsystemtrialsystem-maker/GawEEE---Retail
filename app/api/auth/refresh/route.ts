import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/refresh — see prd.md §4.1. In practice middleware.ts
// refreshes the session cookie on every request automatically; this endpoint
// exists for clients (e.g. a future mobile app) that manage tokens manually.
export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.refreshSession()

  if (error || !data.session) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  return NextResponse.json({ expires_in: data.session.expires_in })
}
