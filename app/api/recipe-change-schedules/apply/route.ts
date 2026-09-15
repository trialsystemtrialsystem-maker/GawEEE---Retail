import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/recipe-change-schedules/apply — no real cron exists in this app
// (confirmed); this applies any due, un-applied schedules
// (effective_date <= today) when the schedule list page is opened,
// replacing that recipe's recipe_ingredients rows with the scheduled
// snapshot and marking applied=true. Disclosed in the UI as check-on-open,
// not a real-time cron — same pattern as Price Scheduler.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error: dueError } = await auth.supabase
    .from('recipe_change_schedules')
    .select('id, recipe_id, new_ingredients, recipes!inner(outlet_id)')
    .eq('applied', false)
    .eq('recipes.outlet_id', outletId)
    .lte('effective_date', today)

  if (dueError) {
    const { status, message } = handleDatabaseError(dueError)
    return NextResponse.json({ error: message }, { status })
  }

  for (const schedule of due ?? []) {
    await auth.supabase.from('recipe_ingredients').delete().eq('recipe_id', schedule.recipe_id)
    const newIngredients = schedule.new_ingredients as { ingredient_product_id: string; quantity: number }[]
    if (newIngredients.length > 0) {
      await auth.supabase
        .from('recipe_ingredients')
        .insert(newIngredients.map((i) => ({ recipe_id: schedule.recipe_id, ingredient_product_id: i.ingredient_product_id, quantity: i.quantity })))
    }
    await auth.supabase.from('recipe_change_schedules').update({ applied: true }).eq('id', schedule.id)
  }

  return NextResponse.json({ applied_count: due?.length ?? 0 })
}
