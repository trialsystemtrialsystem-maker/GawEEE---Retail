import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/onboarding/complete — master_admin only, marks the first-time
// setup wizard done so app/dashboard/layout.tsx stops redirecting into it.
export async function POST() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('companies')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', auth.company_id)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ ok: true })
}
