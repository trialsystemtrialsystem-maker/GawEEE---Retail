'use client'

import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { formatCurrency } from '@/lib/utils/formatting'
import { Button } from '@/components/ui/Button'

export interface SplitLine {
  payment_method: 'cash' | 'e_wallet' | 'bank_transfer'
  amount: string
}

const METHODS: SplitLine['payment_method'][] = ['cash', 'e_wallet', 'bank_transfer']

// Lets a cashier split one sale across up to 2 lines total, at most 1 of
// which is non-cash (server-enforced too — see /api/payments/initiate's
// comment on why: each pending digital method needs its own QR/VA
// confirmation step, so supporting 2+ simultaneous pending methods isn't
// worth the added UI complexity for a case real cashiers rarely hit).
export function SplitPaymentEditor({
  total,
  lines,
  onChange,
}: {
  total: number
  lines: SplitLine[]
  onChange: (lines: SplitLine[]) => void
}) {
  const paid = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const remaining = total - paid

  function updateLine(index: number, patch: Partial<SplitLine>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function addLine() {
    if (lines.length >= 2) return
    const usedMethods = new Set(lines.map((l) => l.payment_method))
    const nextMethod = METHODS.find((m) => !usedMethods.has(m)) ?? 'cash'
    onChange([...lines, { payment_method: nextMethod, amount: remaining > 0 ? String(remaining) : '' }])
  }
  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2 rounded-md border border-gray-200 p-3">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={line.payment_method}
            onChange={(e) => updateLine(i, { payment_method: e.target.value as SplitLine['payment_method'] })}
            className="rounded-sm border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {METHODS.map((m) => (
              <option key={m} value={m} disabled={m !== line.payment_method && m !== 'cash' && lines.some((l) => l.payment_method !== 'cash' && l !== line)}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={line.amount}
            onChange={(e) => updateLine(i, { amount: e.target.value })}
            placeholder="Jumlah"
            className="flex-1 rounded-sm border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={() => removeLine(i)} className="text-sm text-red-500 hover:underline">
            Hapus
          </button>
        </div>
      ))}

      {lines.length < 2 && (
        <Button type="button" variant="ghost" size="sm" onClick={addLine}>
          + Tambah Metode
        </Button>
      )}

      <div className={`flex justify-between text-sm font-medium ${remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
        <span>Sisa Bayar</span>
        <span>{formatCurrency(Math.max(0, remaining))}</span>
      </div>
    </div>
  )
}
