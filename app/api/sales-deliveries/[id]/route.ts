import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, salesDeliveryStatusSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import type { SalesDelivery } from '@/lib/types/database.types'

// PATCH /api/sales-deliveries/[id] — advance status, stamping shipped_at/delivered_at.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const result = validate(salesDeliveryStatusSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const patch: Partial<SalesDelivery> = { status: result.data.status }
  if (result.data.status === 'shipped') patch.shipped_at = new Date().toISOString()
  if (result.data.status === 'delivered') patch.delivered_at = new Date().toISOString()

  const { data, error } = await auth.supabase.from('sales_deliveries').update(patch).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ delivery: data })
}
