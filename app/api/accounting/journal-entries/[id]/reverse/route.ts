import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const schema = z.object({ reason: z.string().trim().min(3, 'Alasan wajib diisi').max(500), entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })

// POST /api/accounting/journal-entries/:id/reverse { reason, entry_date? } —
// jurnal balik. Posted entries are never edited or deleted: a mirror entry
// (debit/kredit ditukar) is posted and the original is marked 'reversed'. The
// reports count both statuses, so the pair nets to zero and the audit trail
// stays intact. Same mechanism the invoice-void trigger uses (059).
export async function POST(request: NextRequest, ctx: RouteContext<'/api/accounting/journal-entries/[id]/reverse'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'journal.post'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { id } = await ctx.params
  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: entry } = await auth.supabase.from('journal_entries').select('*').eq('id', id).single()
  if (!entry) return NextResponse.json({ error: 'Jurnal tidak ditemukan' }, { status: 404 })
  if (!canAccessOutlet(auth, entry.outlet_id)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  if (entry.status !== 'posted') return NextResponse.json({ error: 'Hanya jurnal yang sudah diposting yang bisa dibalik' }, { status: 409 })

  const { data: lines, error: linesError } = await auth.supabase.from('journal_entry_details').select('account_id, debit, credit, description').eq('journal_entry_id', id)
  if (linesError || !lines?.length) return NextResponse.json({ error: 'Baris jurnal tidak ditemukan' }, { status: 404 })

  const fail = (e: unknown) => {
    const { status, message } = handleDatabaseError(e)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: created, error: createError } = await auth.supabase
    .rpc('create_journal_entry', {
      p_outlet_id: entry.outlet_id,
      p_created_by: auth.authUserId,
      p_entry_date: result.data.entry_date ?? new Date().toISOString().slice(0, 10),
      p_description: `Jurnal balik: ${entry.description}`,
      p_lines: lines.map((l) => ({ account_id: l.account_id, debit: l.credit, credit: l.debit, description: l.description })),
      p_source_type: 'reversal',
      p_source_id: id,
    })
    .single()
  const reversalId = (created as { journal_entry_id: string } | null)?.journal_entry_id
  if (createError || !reversalId) return fail(createError ?? { message: 'Gagal membuat jurnal balik' })

  const { error: postError } = await auth.supabase.rpc('post_journal_entry', { p_entry_id: reversalId })
  if (postError) return fail(postError)

  const { error: markError } = await auth.supabase
    .from('journal_entries')
    .update({ status: 'reversed', reversed_date: new Date().toISOString(), reversal_reason: result.data.reason })
    .eq('id', id)
  if (markError) return fail(markError)

  return NextResponse.json({ reversal_entry_id: reversalId })
}
