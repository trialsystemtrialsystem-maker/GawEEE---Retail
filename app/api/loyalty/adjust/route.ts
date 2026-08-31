import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, loyaltyAdjustSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/loyalty/adjust — records a manual point earn (positive) or
// redemption (negative) for a customer. RLS (via customers' outlet) scopes
// which customers a caller may adjust.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(loyaltyAdjustSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (result.data.points_change < 0) {
    const { data: rows } = await auth.supabase
      .from('loyalty_ledger')
      .select('points_change')
      .eq('customer_id', result.data.customer_id)
    const balance = (rows ?? []).reduce((s, r) => s + r.points_change, 0)
    if (balance + result.data.points_change < 0) {
      return NextResponse.json({ error: `Saldo poin tidak cukup (saldo saat ini: ${balance})` }, { status: 400 })
    }
  }

  const { data, error } = await auth.supabase
    .from('loyalty_ledger')
    .insert({ ...result.data, recorded_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ entry: data }, { status: 201 })
}
