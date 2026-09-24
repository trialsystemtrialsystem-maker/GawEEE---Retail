// Builds the year/period-end closing lines: every income and expense account
// balance for the period is zeroed and the net result moves to Laba Ditahan
// (3100). Pure, so the arithmetic is testable without a database.
import type { JournalLine } from '@/lib/utils/journalPosting'

export interface PeriodAccountBalance {
  account_code: string
  account_type: 'income' | 'expense'
  /** Natural-side balance for the period (income: credit-debit, expense: debit-credit). */
  balance: number
}

export interface ClosingResult {
  lines: JournalLine[]
  netProfit: number
}

export function buildClosingLines(balances: PeriodAccountBalance[]): ClosingResult {
  const lines: JournalLine[] = []
  let netProfit = 0
  for (const b of balances) {
    const amount = Math.round(Math.abs(b.balance) * 100) / 100
    if (amount === 0) continue
    // Income normally has a credit balance -> debit it to zero; expense the reverse.
    const normalSide = b.balance > 0
    if (b.account_type === 'income') {
      netProfit += b.balance
      lines.push(normalSide ? { code: b.account_code, debit: amount } : { code: b.account_code, credit: amount })
    } else {
      netProfit -= b.balance
      lines.push(normalSide ? { code: b.account_code, credit: amount } : { code: b.account_code, debit: amount })
    }
  }
  netProfit = Math.round(netProfit * 100) / 100
  if (netProfit > 0) lines.push({ code: '3100', credit: netProfit, description: 'Laba periode berjalan' })
  else if (netProfit < 0) lines.push({ code: '3100', debit: -netProfit, description: 'Rugi periode berjalan' })
  return { lines, netProfit }
}
