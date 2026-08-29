import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/logout — see prd.md §4.1
export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ status: 'logged_out' })
}
