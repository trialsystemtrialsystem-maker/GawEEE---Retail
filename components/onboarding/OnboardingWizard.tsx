'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatCurrency } from '@/lib/utils/formatting'

interface OutletInfo {
  id: string
  name: string
  address: string
  city: string
  phone: string | null
  opening_cash: number
  enabled_payment_methods: string[]
}

const STEP_LABELS = ['Info Outlet', 'Produk Awal', 'Pembayaran', 'Undang Staf', 'Selesai']

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function randomSku() {
  return `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`
}

export function OnboardingWizard({ outlet }: { outlet: OutletInfo }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Step 1 — outlet info
  const [name, setName] = useState(outlet.name)
  const [address, setAddress] = useState(outlet.address === '-' ? '' : outlet.address)
  const [city, setCity] = useState(outlet.city === '-' ? '' : outlet.city)
  const [phone, setPhone] = useState(outlet.phone ?? '')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('21:00')
  const [openingCash, setOpeningCash] = useState(String(outlet.opening_cash || ''))

  // Step 2 — initial products
  const [productName, setProductName] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [addedProducts, setAddedProducts] = useState<{ name: string; selling_price: number }[]>([])

  // Step 3 — payment methods
  const [eWallet, setEWallet] = useState(outlet.enabled_payment_methods.includes('e_wallet'))
  const [bankTransfer, setBankTransfer] = useState(outlet.enabled_payment_methods.includes('bank_transfer'))

  // Step 4 — invite staff
  const [staffEmail, setStaffEmail] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState<'outlet_manager' | 'cashier' | 'staff'>('cashier')
  const [invited, setInvited] = useState<{ email: string; temp_password: string }[]>([])

  async function saveOutletInfo() {
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError('Nama, alamat, dan kota outlet wajib diisi')
      return false
    }
    setSaving(true)
    setError(null)
    try {
      const business_hours = Object.fromEntries(DAYS.map((d) => [d, { open: openTime, close: closeTime }]))
      const res = await fetch(`/api/outlets/${outlet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address,
          city,
          phone: phone || undefined,
          opening_cash: openingCash ? Number(openingCash) : 0,
          business_hours,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan info outlet')
        return false
      }
      return true
    } catch {
      setError('Terjadi kesalahan jaringan')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addProduct() {
    if (!productName.trim() || !purchasePrice || !sellingPrice) {
      setError('Nama produk, harga beli, dan harga jual wajib diisi')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: randomSku(),
          name: productName,
          purchase_price: Number(purchasePrice),
          selling_price: Number(sellingPrice),
          unit_type: 'pcs',
          reorder_level: 5,
          reorder_quantity: 20,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menambah produk')
        return
      }
      setAddedProducts((prev) => [...prev, { name: productName, selling_price: Number(sellingPrice) }])
      setProductName('')
      setPurchasePrice('')
      setSellingPrice('')
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  async function savePaymentMethods() {
    setSaving(true)
    setError(null)
    try {
      const enabled_payment_methods = ['cash', ...(eWallet ? ['e_wallet'] : []), ...(bankTransfer ? ['bank_transfer'] : [])]
      const res = await fetch(`/api/outlets/${outlet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_payment_methods }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan metode pembayaran')
        return false
      }
      return true
    } catch {
      setError('Terjadi kesalahan jaringan')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function inviteStaff() {
    if (!staffEmail.trim() || !staffName.trim()) {
      setError('Email dan nama staf wajib diisi')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: staffEmail,
          full_name: staffName,
          role: staffRole,
          outlet_id: outlet.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengundang staf')
        return
      }
      setInvited((prev) => [...prev, { email: staffEmail, temp_password: data.temp_password }])
      setStaffEmail('')
      setStaffName('')
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  async function finish(destination: '/pos' | '/dashboard') {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Gagal menyelesaikan pengaturan awal')
        return
      }
      router.push(destination)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  async function goNext() {
    setError(null)
    if (step === 1) {
      if (!(await saveOutletInfo())) return
    }
    if (step === 3) {
      if (!(await savePaymentMethods())) return
    }
    setStep((s) => s + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 <= step ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </div>
            {i < STEP_LABELS.length - 1 && <div className={`h-0.5 w-6 ${i + 1 < step ? 'bg-blue-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-medium text-gray-500">
        Langkah {step} dari {STEP_LABELS.length}: {STEP_LABELS[step - 1]}
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {step === 1 && (
        <div className="space-y-4">
          <Input label="Nama Outlet" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Alamat" required value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Kota" required value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Jam Buka" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
            <Input label="Jam Tutup" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            <Input
              label="Kas Awal (Rp)"
              type="number"
              min={0}
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tambahkan beberapa produk untuk mulai berjualan. Langkah ini opsional — Anda bisa menambah produk lain
            kapan saja dari menu Produk.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Nama produk" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <Input
              placeholder="Harga beli"
              type="number"
              min={0}
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
            <Input
              placeholder="Harga jual"
              type="number"
              min={0}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addProduct} disabled={saving}>
            + Tambah Produk
          </Button>
          {addedProducts.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
              {addedProducts.map((p, i) => (
                <li key={i} className="flex justify-between px-3 py-2">
                  <span>{p.name}</span>
                  <span className="text-gray-500">{formatCurrency(p.selling_price)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Pilih metode pembayaran yang diterima di kasir.</p>
          <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 text-sm text-gray-400">
            <input type="checkbox" checked disabled />
            Tunai (selalu aktif)
          </label>
          <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 text-sm">
            <input type="checkbox" checked={eWallet} onChange={(e) => setEWallet(e.target.checked)} />
            E-Wallet (QR simulasi)
          </label>
          <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 text-sm">
            <input type="checkbox" checked={bankTransfer} onChange={(e) => setBankTransfer(e.target.checked)} />
            Transfer Bank (VA simulasi)
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Undang anggota tim untuk membantu operasional. Langkah ini opsional — Anda bisa mengundang staf lain
            kapan saja dari Pengaturan.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input placeholder="Email" type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} />
            <Input placeholder="Nama lengkap" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as typeof staffRole)}
              className="rounded-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="outlet_manager">Manajer Outlet</option>
              <option value="cashier">Kasir</option>
              <option value="staff">Staf</option>
            </select>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={inviteStaff} disabled={saving}>
            + Undang Staf
          </Button>
          {invited.length > 0 && (
            <div className="space-y-2">
              <Alert variant="info">
                Belum ada pengiriman email sungguhan — catat kata sandi sementara di bawah dan sampaikan langsung ke
                staf yang diundang.
              </Alert>
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
                {invited.map((u, i) => (
                  <li key={i} className="flex justify-between px-3 py-2">
                    <span>{u.email}</span>
                    <code className="text-gray-500">{u.temp_password}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
            ✓
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Pengaturan awal selesai!</h2>
          <p className="text-sm text-gray-600">Outlet Anda siap digunakan. Mulai transaksi pertama, atau lihat dashboard.</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => finish('/pos')} isLoading={saving}>
              Mulai Transaksi
            </Button>
            <Button variant="secondary" onClick={() => finish('/dashboard')} disabled={saving}>
              Ke Dashboard
            </Button>
          </div>
        </div>
      )}

      {step < 5 && (
        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || saving}>
            Kembali
          </Button>
          <div className="flex gap-2">
            {(step === 2 || step === 4) && (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s + 1)} disabled={saving}>
                Lewati
              </Button>
            )}
            <Button type="button" onClick={goNext} isLoading={saving}>
              Lanjut
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
