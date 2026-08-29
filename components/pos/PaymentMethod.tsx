'use client'

import { usePosStore } from '@/store/posStore'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'

const METHODS: Array<'cash' | 'e_wallet' | 'bank_transfer'> = ['cash', 'e_wallet', 'bank_transfer']

export function PaymentMethod() {
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const setPaymentMethod = usePosStore((s) => s.setPaymentMethod)

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-gray-500">Metode Pembayaran</legend>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((method) => (
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
