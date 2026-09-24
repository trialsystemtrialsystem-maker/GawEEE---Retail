// Best-effort journal posting shared by the modules that move money but are not
// accounting screens themselves (payroll, kasbon, fixed assets…). Same contract
// as the earlier inline posts (PO receive, expense pay, supplier payment): it
// NEVER throws and never blocks the real business action — a missing account or
// database error just means no journal, and the caller gets `null`.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface JournalLine {
  /** chart_of_accounts.account_code, resolved per outlet. */
  code: string
  debit?: number
  credit?: number
  description?: string
}

// Accounts these flows need that the default chart (014) does not seed. Created
// on first use so posting works on existing companies without a migration.
const EXTRA_ACCOUNTS: Record<string, { name: string; type: string }> = {
  '1150': { name: 'Piutang Karyawan (Kasbon)', type: 'asset' },
  '1500': { name: 'Aset Tetap', type: 'asset' },
  '1590': { name: 'Akumulasi Penyusutan', type: 'asset' },
  '5400': { name: 'Beban Penyusutan', type: 'expense' },
  '5110': { name: 'Beban Lembur & Insentif', type: 'expense' },
}

async function accountId(supabase: SupabaseClient, outletId: string, code: string): Promise<string | null> {
  const { data } = await supabase.from('chart_of_accounts').select('id').eq('outlet_id', outletId).eq('account_code', code).maybeSingle()
  if (data) return data.id
  const extra = EXTRA_ACCOUNTS[code]
  if (!extra) return null
  const { data: created } = await supabase
    .from('chart_of_accounts')
    .insert({ outlet_id: outletId, account_code: code, account_name: extra.name, account_type: extra.type })
    .select('id')
    .single()
  return created?.id ?? null
}

export async function postJournal(
  supabase: SupabaseClient,
  params: {
    outletId: string
    createdBy: string
    date: string
    description: string
    sourceType: string
    sourceId: string
    lines: JournalLine[]
  }
): Promise<string | null> {
  try {
    const lines = params.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0)
    if (lines.length < 2) return null

    // Idempotent per source: never double-post the same business event.
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('outlet_id', params.outletId)
      .eq('source_type', params.sourceType)
      .eq('source_id', params.sourceId)
      .neq('status', 'reversed')
      .maybeSingle()
    if (existing) return existing.id

    const resolved = []
    for (const l of lines) {
      const id = await accountId(supabase, params.outletId, l.code)
      if (!id) return null
      resolved.push({ account_id: id, debit: l.debit ?? 0, credit: l.credit ?? 0, description: l.description ?? null })
    }

    const { data: entry } = await supabase
      .rpc('create_journal_entry', {
        p_outlet_id: params.outletId,
        p_created_by: params.createdBy,
        p_entry_date: params.date,
        p_description: params.description,
        p_lines: resolved,
        p_source_type: params.sourceType,
        p_source_id: params.sourceId,
      })
      .single()
    const entryId = (entry as { journal_entry_id: string } | null)?.journal_entry_id
    if (!entryId) return null
    await supabase.rpc('post_journal_entry', { p_entry_id: entryId })
    return entryId
  } catch {
    return null
  }
}
