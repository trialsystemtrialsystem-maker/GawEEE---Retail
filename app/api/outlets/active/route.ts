import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { ACTIVE_OUTLET_COOKIE } from '@/lib/server/activeOutlet'

// POST /api/outlets/active { outlet_id } — remembers which outlet an owner
// (master_admin, not tied to one outlet) is currently working in. Only affects
// pages that need a default outlet; anyone with a fixed outlet is unaffected.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = validate(z.object({ outlet_id: z.string().uuid() }), await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  if (!canAccessOutlet(auth, result.data.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  // canAccessOutlet() lets an owner through for any id, so confirm the outlet
  // really belongs to this company before remembering it.
  const { data: outlet } = await auth.supabase.from('outlets').select('id').eq('id', result.data.outlet_id).eq('company_id', auth.company_id).maybeSingle()
  if (!outlet) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 403 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ACTIVE_OUTLET_COOKIE, result.data.outlet_id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  return res
}
