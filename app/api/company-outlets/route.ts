import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/company-outlets — every outlet in the caller's company (id + name
// only), used by pickers like Stock Transfer's source/destination select.
// Relies on the same-company SELECT policy added in 023_stock_transfers.sql.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await auth.supabase.from('outlets').select('id, name').eq('company_id', auth.company_id).order('name')

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ outlets: data })
}
