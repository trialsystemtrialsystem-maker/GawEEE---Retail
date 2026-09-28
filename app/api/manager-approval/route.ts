import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { checkRateLimit, clientIp } from '@/lib/utils/rateLimit'
import { verifyManagerPin } from '@/lib/server/discountGuard'

// POST /api/manager-approval { outlet_id, pin } — a cashier at the POS asks
// a manager to type their PIN to check, up front, whether it will approve
// something the cashier alone couldn't (e.g. a discount above the cap). The
// invoice route re-verifies the PIN itself when the sale is actually
// created, so this endpoint is a convenience check, not a grant — nothing
// from its response is trusted later on its own.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const outletId = body.outlet_id as string | undefined
  const pin = (body.pin as string | undefined)?.trim()
  if (!outletId || !pin) return NextResponse.json({ error: 'outlet_id dan pin wajib diisi' }, { status: 400 })
  if (!canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const limit = await checkRateLimit(`manager-approval:${outletId}:${clientIp(request)}`, 5, 300)
  if (!limit.allowed) {
    return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} menit.` }, { status: 429 })
  }

  const manager = await verifyManagerPin(auth, outletId, pin)
  if (!manager) return NextResponse.json({ error: 'PIN tidak valid atau bukan manager' }, { status: 401 })
  return NextResponse.json({ approved: true, manager_name: manager.name })
}
