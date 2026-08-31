'use client'

import { useEffect, useState } from 'react'
import { usePosStore } from '@/store/posStore'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'

const ALL_METHODS: Array<'cash' | 'e_wallet' | 'bank_transfer'> = ['cash', 'e_wallet', 'bank_transfer']

export function PaymentMethod({ outletId }: { outletId: string }) {
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod)
  const [methods, setMethods] = useState(ALL_METHODS)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/outlets/${outletId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const enabled: string[] | undefined = data.outlet?.enabled_payment_methods
        if (enabled?.length) {
          const filtered = ALL_METHODS.filter((m) => enabled.includes(m))
          if (filtered.length) setMethods(filtered)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [outletId])

  useEffect(() => {
    if (!methods.includes(paymentMethod as (typeof ALL_METHODS)[number])) {
      setPaymentMethod(methods[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods])

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-gray-500">Metode Pembayaran</legend>
      <div className="grid grid-cols-3 gap-2">
        {methods.map((method) => (
          <label
            key={method}
            className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors ${
              paymentMethod === method
                ? 'border-blue-500 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="payment_method"
              value={method}
              checked={paymentMethod === method}
              onChange={() => setPaymentMethod(method)}
              className="sr-only"
            />
            {PAYMENT_METHOD_LABELS[method]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
