import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

interface BulkBody {
  operation_type: 'price_increase' | 'price_decrease'
  outlets: string[] | ['all']
  parameters: { percentage: number }
  notification_message?: string
}

// POST /api/admin/bulk-operation/products — master_admin only. See prd.md §4.7.
//
// Executes immediately (no cron/queue infra exists yet — see roadmap.md's
// scheduling note — so `scheduled_for` in the PRD spec isn't honored; every
// operation runs synchronously and is recorded either way).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = (await request.json()) as BulkBody
  if (!['price_increase', 'price_decrease'].includes(body.operation_type)) {
    return NextResponse.json({ error: 'operation_type tidak didukung' }, { status: 400 })
  }
  const percentage = body.parameters?.percentage
  if (typeof percentage !== 'number' || percentage <= 0) {
    return NextResponse.json({ error: 'parameters.percentage wajib diisi (> 0)' }, { status: 400 })
  }

  const { data: operation, error: opError } = await auth.supabase
    .from('bulk_admin_operations')
    .insert({
      company_id: auth.company_id,
      admin_id: auth.authUserId,
      operation_type: body.operation_type,
      outlets_affected: body.outlets,
      operation_description: body.notification_message ?? null,
      parameters: body.parameters,
      status: 'executing',
      execution_start_time: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (opError) {
    const { status, message } = handleDatabaseError(opError)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: products, error: productsError } = await auth.supabase
    .from('products')
    .select('id, selling_price')
    .eq('company_id', auth.company_id)

  if (productsError) {
    const { status, message } = handleDatabaseError(productsError)
    return NextResponse.json({ error: message }, { status })
  }

  const multiplier = body.operation_type === 'price_increase' ? 1 + percentage / 100 : 1 - percentage / 100
  let successCount = 0
  let failedCount = 0

  for (const product of products ?? []) {
    const newPrice = Math.round(product.selling_price * multiplier)
    const { error } = await auth.supabase.from('products').update({ selling_price: newPrice }).eq('id', product.id)
    if (error) failedCount += 1
    else successCount += 1
  }

  await auth.supabase
    .from('bulk_admin_operations')
    .update({
      status: 'completed',
      execution_end_time: new Date().toISOString(),
      success_count: successCount,
      failed_count: failedCount,
    })
    .eq('id', operation!.id)

  return NextResponse.json({
    operation_id: operation!.id,
    status: 'completed',
    preview: { outlets_affected: body.outlets.length, products_affected: successCount },
    execution_time: new Date().toISOString(),
  })
}
