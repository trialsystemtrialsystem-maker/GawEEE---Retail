'use client'

import { useState } from 'react'
import { usePosStore } from '@/store/posStore'
import { ProductSearch } from '@/components/pos/ProductSearch'
import { ShoppingCart } from '@/components/pos/ShoppingCart'
import { PaymentMethod } from '@/components/pos/PaymentMethod'
import { Receipt } from '@/components/pos/Receipt'
import { ShiftStatusBanner } from '@/components/pos/ShiftStatusBanner'
import { HeldTransactionsPanel } from '@/components/pos/HeldTransactionsPanel'
import { BundleQuickAdd } from '@/components/pos/BundleQuickAdd'
import { QrCodeCanvas } from '@/components/pos/QrCodeCanvas'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

type Step = 'cart' | 'processing_cash' | 'processing_ewallet' | 'processing_bank' | 'success'

interface InvoiceResult {
  invoice_id: string
  invoice_number: string
  total: number
  created_at: string
}

export function POSScreen({ outletId, cashierName }: { outletId: string; cashierName?: string }) {
  const [step, setStep] = useState<Step>('cart')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [vaInfo, setVaInfo] = useState<{ number: string; bank: string } | null>(null)
  const [cashReceived, setCashReceived] = useState('')

  const items = usePosStore((s) => s.items)
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const clearCart = usePosStore((s) => s.clearCart)

  async function handleCheckout() {
    if (items.length === 0) {
      setError('Keranjang tidak boleh kosong')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Gagal membuat invoice')
        return
      }

      setInvoiceResult({
        invoice_id: data.invoice_id,
        invoice_number: data.invoice_number,
        total: data.total,
        created_at: new Date().toISOString(),
      })

      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: data.invoice_id, payment_method: paymentMethod, amount: data.total }),
      })
      const initData = await initRes.json()

      if (paymentMethod === 'cash') {
        setStep('processing_cash')
      } else if (paymentMethod === 'e_wallet') {
        setPaymentId(initData.payment_id)
        setQrCodeData(initData.qr_code_data ?? null)
        setStep('processing_ewallet')
      } else {
        setPaymentId(initData.payment_id)
        setVaInfo({ number: initData.virtual_account_number, bank: initData.bank_code })
        setStep('processing_bank')
      }
    } catch {
      setError('Terjadi kesalahan jaringan, coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDigitalPayment() {
    if (!paymentId) return
    await fetch(`/api/payments/${paymentId}/simulate-success`, { method: 'POST' })
    setStep('success')
  }

  function confirmCashPayment() {
    setStep('success')
  }

  function startNewTransaction() {
    clearCart()
    setInvoiceResult(null)
    setPaymentId(null)
    setQrCodeData(null)
    setVaInfo(null)
    setCashReceived('')
    setStep('cart')
  }

  const cashReceivedNumber = Number(cashReceived) || 0
  const change = Math.max(0, cashReceivedNumber - (invoiceResult?.total ?? 0))

  if (step === 'success' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Receipt
          invoiceNumber={invoiceResult.invoice_number}
          total={invoiceResult.total}
          items={items}
          createdAt={invoiceResult.created_at}
        />
        <Button className="mt-6 w-full" onClick={startNewTransaction}>
          Transaksi Baru
        </Button>
      </div>
    )
  }

  if (step === 'processing_cash' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Pembayaran Tunai</h2>
        <div className="flex justify-between text-sm">
          <span>Total</span>
          <span className="font-semibold">{formatCurrency(invoiceResult.total)}</span>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Jumlah diterima</label>
          <input
            type="number"
            autoFocus
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder="Jumlah diterima"
            className="w-full rounded-md border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-between text-sm">
          <span>Kembalian</span>
          <span className="font-semibold">{formatCurrency(change)}</span>
        </div>
        <Button
          className="w-full"
          disabled={cashReceivedNumber < invoiceResult.total}
          onClick={confirmCashPayment}
        >
          Konfirmasi Pembayaran
        </Button>
      </div>
    )
  }

  if (step === 'processing_ewallet' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Pembayaran E-Wallet</h2>
        <p className="text-sm text-gray-600">Total: {formatCurrency(invoiceResult.total)}</p>
        {qrCodeData ? (
          <QrCodeCanvas data={qrCodeData} />
        ) : (
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-xs text-gray-400">
            QR CODE
          </div>
        )}
        <p className="text-sm text-gray-500">Scan dengan e-wallet Anda</p>
        <Alert variant="info">
          Mode demo — belum terhubung ke Doku Pay. Klik tombol di bawah untuk mensimulasikan
          pembayaran berhasil.
        </Alert>
        <Button className="w-full" onClick={confirmDigitalPayment}>
          Simulasikan Pembayaran Berhasil
        </Button>
        <button type="button" onClick={startNewTransaction} className="text-sm text-gray-500 hover:underline">
          Batal Transaksi
        </button>
      </div>
    )
  }

  if (step === 'processing_bank' && invoiceResult && vaInfo) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Pembayaran Transfer Bank</h2>
        <p className="text-sm text-gray-600">Total: {formatCurrency(invoiceResult.total)}</p>
        <div className="space-y-1 rounded-md bg-gray-50 p-3 text-sm">
          <p>Bank: {vaInfo.bank}</p>
          <p>Rekening: {vaInfo.number}</p>
          <p>Atas Nama: PT Berkah Purnama Sewu</p>
        </div>
        <Alert variant="info">
          Mode demo — belum terhubung ke bank aggregator. Klik tombol di bawah untuk
          mensimulasikan transfer diterima.
        </Alert>
        <Button className="w-full" onClick={confirmDigitalPayment}>
          Simulasikan Transfer Diterima
        </Button>
        <button type="button" onClick={startNewTransaction} className="text-sm text-gray-500 hover:underline">
          Batal Transaksi
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <ShiftStatusBanner outletId={outletId} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Kasir</h1>
          {cashierName && <span className="text-sm text-gray-500">Kasir: {cashierName}</span>}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <HeldTransactionsPanel outletId={outletId} />
          <BundleQuickAdd outletId={outletId} />
        </div>
        <ProductSearch outletId={outletId} />
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {error && <Alert variant="danger">{error}</Alert>}
        <ShoppingCart />
        <PaymentMethod outletId={outletId} />
        <Button className="w-full" size="lg" onClick={handleCheckout} isLoading={isSubmitting} disabled={items.length === 0}>
          Proses Pembayaran
        </Button>
      </div>
      </div>
    </div>
  )
}
