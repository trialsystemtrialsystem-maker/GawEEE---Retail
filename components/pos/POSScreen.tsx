'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePosStore } from '@/store/posStore'
import { ProductSearch } from '@/components/pos/ProductSearch'
import { ShoppingCart } from '@/components/pos/ShoppingCart'
import { PaymentMethod } from '@/components/pos/PaymentMethod'
import { Receipt } from '@/components/pos/Receipt'
import { ShiftStatusBanner } from '@/components/pos/ShiftStatusBanner'
import { HeldTransactionsPanel } from '@/components/pos/HeldTransactionsPanel'
import { BundleQuickAdd } from '@/components/pos/BundleQuickAdd'
import { QrCodeCanvas } from '@/components/pos/QrCodeCanvas'
import { SplitPaymentEditor, type SplitLine } from '@/components/pos/SplitPaymentEditor'
import { KasirStatsHeader } from '@/components/pos/KasirStatsHeader'
import { CustomerPicker, type PickedCustomer } from '@/components/pos/CustomerPicker'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'
import { useNotificationStore } from '@/store/notificationStore'

type Step = 'cart' | 'processing_cash' | 'processing_ewallet' | 'processing_bank' | 'success' | 'pending_receipt'

interface InvoiceResult {
  invoice_id: string
  invoice_number: string
  total: number
  created_at: string
}

const QUICK_CASH_STEPS = [5000, 10000, 20000, 50000, 100000]

export function POSScreen({ outletId, cashierName }: { outletId: string; cashierName?: string }) {
  const [step, setStep] = useState<Step>('cart')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<InvoiceResult | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [vaInfo, setVaInfo] = useState<{ number: string; bank: string } | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [useSplitPayment, setUseSplitPayment] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([])
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [payLater, setPayLater] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const items = usePosStore((s) => s.items)
  const paymentMethod = usePosStore((s) => s.paymentMethod)
  const clearCart = usePosStore((s) => s.clearCart)
  const total = usePosStore((s) => s.total())
  const subtotal = usePosStore((s) => s.subtotal())
  const discountAmount = usePosStore((s) => s.discountAmount)
  const discountReason = usePosStore((s) => s.discountReason)
  const setDiscount = usePosStore((s) => s.setDiscount)

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setIsApplyingCoupon(true)
    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, code: couponCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Kode promo tidak valid', 'danger')
        return
      }
      const coupon = data.coupon as { code: string; discount_type: 'percentage' | 'fixed'; discount_value: number }
      const amount = coupon.discount_type === 'percentage' ? Math.round((subtotal * coupon.discount_value) / 100) : coupon.discount_value
      setDiscount(discountAmount + amount, discountReason ? `${discountReason}; Promo: ${coupon.code}` : `Promo: ${coupon.code}`)
      showToast(`Promo "${coupon.code}" diterapkan`, 'success')
      setCouponCode('')
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const splitPaid = splitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const splitReady = useSplitPayment && splitLines.length > 0 && Math.round(splitPaid) === Math.round(total)

  async function handleCheckout() {
    if (items.length === 0) {
      setError('Keranjang tidak boleh kosong')
      return
    }
    if (!payLater && useSplitPayment && !splitReady) {
      setError('Sisa bayar harus 0 sebelum memproses pembayaran')
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
          customer_name: customer?.name,
          customer_phone: customer?.phone,
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            discount: i.discount,
            unit_label: i.unit_label,
            unit_quantity: i.unit_quantity,
            notes: i.notes,
          })),
          discount_amount: discountAmount,
          discount_reason: discountReason || undefined,
          payment_method: payLater ? 'pay_later' : useSplitPayment ? (splitLines.find((l) => l.payment_method !== 'cash')?.payment_method ?? 'cash') : paymentMethod,
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

      if (payLater) {
        // No payment collected yet — the invoice was created with
        // payment_status left 'pending' by create_invoice() (any
        // non-'cash' p_payment_method lands as pending), so there's
        // nothing to hand to /api/payments/initiate. Settle it later from
        // Riwayat Kasir once the customer actually pays.
        setStep('pending_receipt')
        return
      }

      const payments = useSplitPayment
        ? splitLines.map((l) => ({ payment_method: l.payment_method, amount: Number(l.amount) || 0 }))
        : [{ payment_method: paymentMethod, amount: data.total }]

      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: data.invoice_id, payments }),
      })
      const initData = await initRes.json()
      if (!initRes.ok) {
        setError(typeof initData.error === 'string' ? initData.error : 'Gagal memproses pembayaran')
        return
      }

      const pendingLine = (initData.payments ?? []).find((p: { status: string }) => p.status === 'pending')

      if (!pendingLine) {
        // All lines settled immediately (pure cash, or a split fully covered
        // by cash) — for a single pure-cash payment keep the existing
        // received/change screen; for anything else go straight to success.
        if (!useSplitPayment && paymentMethod === 'cash') {
          setStep('processing_cash')
        } else {
          setStep('success')
        }
      } else if (pendingLine.payment_method === 'e_wallet') {
        setPaymentId(pendingLine.payment_id)
        setQrCodeData(pendingLine.qr_code_data ?? null)
        setStep('processing_ewallet')
      } else {
        setPaymentId(pendingLine.payment_id)
        setVaInfo({ number: pendingLine.virtual_account_number, bank: pendingLine.bank_code })
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
    setUseSplitPayment(false)
    setSplitLines([])
    setCustomer(null)
    setPayLater(false)
    setStep('cart')
  }

  const cashReceivedNumber = Number(cashReceived) || 0
  const change = Math.max(0, cashReceivedNumber - (invoiceResult?.total ?? 0))

  if (step === 'success' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-white shadow-lg">
        <div className="bg-gradient-to-br from-[var(--status-good)] to-[var(--color-secondary-accent)] px-6 py-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl">✅</div>
          <h2 className="mt-3 text-xl font-bold text-white">Pembayaran Berhasil!</h2>
          <p className="text-sm text-white/80">{invoiceResult.invoice_number}</p>
        </div>
        <div className="p-6">
          <Receipt invoiceNumber={invoiceResult.invoice_number} total={invoiceResult.total} items={items} createdAt={invoiceResult.created_at} />
          <Button className="mt-6 w-full !bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]" onClick={startNewTransaction}>
            Transaksi Baru
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'pending_receipt' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--brand-100)] bg-white shadow-lg">
        <div className="bg-gradient-to-br from-amber-500 to-amber-400 px-6 py-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl">⏳</div>
          <h2 className="mt-3 text-xl font-bold text-white">Menunggu Pembayaran</h2>
          <p className="text-sm text-white/80">{invoiceResult.invoice_number} — bayar nanti</p>
        </div>
        <div className="p-6">
          <Receipt invoiceNumber={invoiceResult.invoice_number} total={invoiceResult.total} items={items} createdAt={invoiceResult.created_at} />
          <div className="mt-4">
            <Alert variant="warning">Transaksi tersimpan sebagai belum dibayar. Selesaikan pembayarannya nanti dari Riwayat Kasir.</Alert>
          </div>
          <Button className="mt-4 w-full !bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]" onClick={startNewTransaction}>
            Transaksi Baru
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'processing_cash' && invoiceResult) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--brand-100)] bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-[var(--brand-900)]">💵 Pembayaran Tunai</h2>
        <div className="rounded-xl bg-[var(--brand-50)] p-4 text-center">
          <p className="text-xs text-[var(--chart-muted)]">Total Tagihan</p>
          <p className="text-2xl font-extrabold text-[var(--brand-900)]">{formatCurrency(invoiceResult.total)}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Jumlah diterima</label>
          <input
            type="number"
            autoFocus
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder="Jumlah diterima"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCashReceived(String(invoiceResult.total))}
            className="rounded-full border border-[var(--brand-500)] px-3 py-1 text-xs font-semibold text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
          >
            Uang Pas
          </button>
          {Array.from(new Set(QUICK_CASH_STEPS.map((roundTo) => Math.ceil(invoiceResult.total / roundTo) * roundTo)))
            .filter((amount) => amount > invoiceResult.total)
            .slice(0, 3)
            .map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setCashReceived(String(amount))}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-[var(--brand-500)] hover:text-[var(--brand-600)]"
              >
                {formatCurrency(amount)}
              </button>
            ))}
        </div>
        <div className="flex justify-between rounded-xl bg-[var(--status-good)]/10 p-3 text-sm">
          <span className="font-medium text-[var(--status-good)]">Kembalian</span>
          <span className="font-bold text-[var(--status-good)]">{formatCurrency(change)}</span>
        </div>
        <Button
          className="w-full !bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]"
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
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--brand-100)] bg-white p-6 text-center shadow-lg">
        <h2 className="text-lg font-bold text-[var(--brand-900)]">📱 Pembayaran E-Wallet</h2>
        <p className="text-sm text-gray-600">Total: <span className="font-bold text-[var(--brand-900)]">{formatCurrency(invoiceResult.total)}</span></p>
        <div className="mx-auto w-fit rounded-xl border-2 border-[var(--brand-100)] p-3">
          {qrCodeData ? (
            <QrCodeCanvas data={qrCodeData} />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-xs text-gray-400">QR CODE</div>
          )}
        </div>
        <p className="text-sm text-gray-500">Scan dengan e-wallet Anda</p>
        <Alert variant="info">
          Mode demo — belum terhubung ke Doku Pay. Klik tombol di bawah untuk mensimulasikan
          pembayaran berhasil.
        </Alert>
        <Button className="w-full !bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]" onClick={confirmDigitalPayment}>
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
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--brand-100)] bg-white p-6 shadow-lg">
        <h2 className="text-lg font-bold text-[var(--brand-900)]">🏦 Pembayaran Transfer Bank</h2>
        <p className="text-sm text-gray-600">Total: <span className="font-bold text-[var(--brand-900)]">{formatCurrency(invoiceResult.total)}</span></p>
        <div className="space-y-1 rounded-xl bg-[var(--brand-50)] p-4 text-sm">
          <p>Bank: <span className="font-semibold">{vaInfo.bank}</span></p>
          <p>Rekening: <span className="font-mono font-semibold">{vaInfo.number}</span></p>
          <p>Atas Nama: PT Berkah Purnama Sewu</p>
        </div>
        <Alert variant="info">
          Mode demo — belum terhubung ke bank aggregator. Klik tombol di bawah untuk
          mensimulasikan transfer diterima.
        </Alert>
        <Button className="w-full !bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]" onClick={confirmDigitalPayment}>
          Simulasikan Transfer Diterima
        </Button>
        <button type="button" onClick={startNewTransaction} className="text-sm text-gray-500 hover:underline">
          Batal Transaksi
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ShiftStatusBanner outletId={outletId} />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--brand-900)]">🛒 Kasir</h1>
          <p className="text-sm text-gray-500">
            {cashierName ? `Kasir: ${cashierName}` : 'Kelola transaksi penjualan'}
          </p>
        </div>
        <Link
          href="/dashboard/staff/cashier-shifts"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50"
        >
          🗄️ Tutup Kasir
        </Link>
      </div>

      <KasirStatsHeader />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-2">
            <HeldTransactionsPanel outletId={outletId} />
            <BundleQuickAdd outletId={outletId} />
          </div>
          <ProductSearch outletId={outletId} />
        </div>

        <div className="space-y-4 self-start rounded-2xl border border-[var(--brand-100)] bg-white p-4 shadow-lg lg:sticky lg:top-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <ShoppingCart outletId={outletId} />

          <CustomerPicker outletId={outletId} value={customer} onChange={setCustomer} />

          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Kode Promo"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Button type="button" variant="secondary" size="sm" isLoading={isApplyingCoupon} onClick={applyCoupon}>
              Pakai
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPayLater(false)}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                !payLater ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              ⚡ Bayar Sekarang
            </button>
            <button
              type="button"
              onClick={() => setPayLater(true)}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors ${
                payLater ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              🕐 Bayar Nanti
            </button>
          </div>

          {!payLater && (
            <>
              <button
                type="button"
                onClick={() => {
                  setUseSplitPayment((v) => !v)
                  setSplitLines([])
                }}
                className="text-sm font-medium text-[var(--brand-600)] hover:underline"
              >
                {useSplitPayment ? 'Gunakan 1 metode pembayaran' : '+ Bayar dengan beberapa metode'}
              </button>

              {useSplitPayment ? (
                <SplitPaymentEditor total={total} lines={splitLines} onChange={setSplitLines} />
              ) : (
                <PaymentMethod outletId={outletId} />
              )}
            </>
          )}

          <Button
            className={`w-full !shadow-md ${payLater ? '!bg-gradient-to-r !from-amber-600 !to-amber-500' : '!bg-gradient-to-r !from-[var(--brand-600)] !to-[var(--brand-500)]'}`}
            size="lg"
            onClick={handleCheckout}
            isLoading={isSubmitting}
            disabled={items.length === 0 || (!payLater && useSplitPayment && !splitReady)}
          >
            {payLater ? 'Simpan Transaksi' : 'Proses Pembayaran'}
            {items.length > 0 && ` · ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
