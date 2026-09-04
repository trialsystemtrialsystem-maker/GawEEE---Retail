import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/price-schedules/apply — no real cron exists in this app
// (confirmed); this applies any due, un-applied schedules
// (effective_date <= today) when the schedule list page is opened, updating
// products.selling_price and marking applied=true. Disclosed in the UI as
// check-on-open, not a real-time cron.
export async function POST() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error: dueError } = await auth.supabase
    .from('price_schedules')
    .select('id, product_id, new_price')
    .eq('applied', false)
    .lte('effective_date', today)

  if (dueError) {
    const { status, message } = handleDatabaseError(dueError)
    return NextResponse.json({ error: message }, { status })
  }

  for (const schedule of due ?? []) {
    await auth.supabase.from('products').update({ selling_price: schedule.new_price }).eq('id', schedule.product_id)
    await auth.supabase.from('price_schedules').update({ applied: true }).eq('id', schedule.id)
  }

  return NextResponse.json({ applied_count: due?.length ?? 0 })
}
