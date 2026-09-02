import { PRICING_TIERS } from '@/lib/utils/constants'
import { formatCurrency } from '@/lib/utils/formatting'
import { TryDemoButton } from '@/components/common/TryDemoButton'
import { TryPosDemoButton } from '@/components/common/TryPosDemoButton'

const FEATURES = [
  { icon: '🛒', title: 'Real-time POS', desc: 'Proses transaksi cepat dengan barcode scanning dan multiple payment methods.', color: 'var(--chart-1)' },
  { icon: '📦', title: 'Inventory Management', desc: 'Tracking stok real-time dengan otomatis alert ketika stock habis.', color: 'var(--chart-2)' },
  { icon: '📊', title: 'Financial Reports', desc: 'Daily P&L, cash position, dan tax reports yang siap audit.', color: 'var(--chart-3)' },
  { icon: '🏬', title: 'Multi-outlet Support', desc: 'Kelola 1 sampai 50+ outlet dari satu Master Admin Panel.', color: 'var(--chart-7)' },
  { icon: '💳', title: 'Payment Integration', desc: 'E-wallet (OVO, Dana, Gopay) dan Virtual Account bank langsung terintegrasi.', color: 'var(--chart-5)' },
  { icon: '✅', title: 'Compliance Ready', desc: 'Audit trail, tax reporting, dan invoice archiving otomatis.', color: 'var(--chart-6)' },
]

const PAIN_POINTS = [
  { title: 'Spreadsheet Chaos', desc: 'Data tersebar, tidak real-time, rawan human error.', color: 'var(--chart-8)' },
  { title: 'Masalah Inventori', desc: 'Stok kosong mendadak atau overstock yang menumpuk modal.', color: 'var(--chart-2)' },
  { title: 'Rekonsiliasi Manual', desc: 'Menghabiskan waktu berjam-jam mencocokkan kas dan transaksi.', color: 'var(--chart-4)' },
  { title: 'Tanpa Visibilitas', desc: 'Tidak ada data tren untuk mengambil keputusan bisnis.', color: 'var(--chart-7)' },
]

const STEPS = [
  { title: 'Sign up', desc: 'Daftar akun dalam 2 menit.' },
  { title: 'Tambah Produk', desc: 'Input produk & stok awal Anda.' },
  { title: 'Mulai Jualan', desc: 'Transaksi pertama lewat POS.' },
  { title: 'Lihat Laporan', desc: 'Pantau dashboard secara real-time.' },
]

const FAQS = [
  { q: 'Apa itu GawEEE?', a: 'GawEEE adalah platform ERP untuk toko retail UMKM: POS, inventori, keuangan, dan multi-outlet dalam satu dashboard.' },
  { q: 'Berapa biayanya?', a: `Mulai dari ${formatCurrency(99000)}/bulan untuk 1 toko. Lihat detail di bagian Pricing.` },
  { q: 'Apakah bisa multi-outlet?', a: 'Bisa. Paket Professional mendukung hingga 5 toko dengan Master Admin Panel.' },
  { q: 'Bagaimana dengan payment gateway?', a: 'Terintegrasi dengan e-wallet (OVO, Dana, Gopay) dan Virtual Account bank.' },
  { q: 'Apakah ada support bahasa Indonesia?', a: 'Ya, seluruh aplikasi dan dukungan pelanggan menggunakan Bahasa Indonesia.' },
  { q: 'Apakah aman?', a: 'Data terenkripsi (AES-256 at rest, TLS in transit) dengan audit trail lengkap untuk setiap transaksi.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero — navy gradient matching the app's own sidebar/header identity */}
      <section
        className="relative overflow-hidden pb-24 pt-20 text-white"
        style={{ background: 'linear-gradient(160deg, var(--brand-900), var(--brand-950))' }}
      >
        {/* decorative color blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--chart-1)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--chart-3)' }}
        />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 md:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-block rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-blue-200">
                ERP untuk UMKM Retail Indonesia
              </span>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                Sistem ERP untuk Toko Retail Anda
              </h1>
              <p className="text-xl leading-relaxed text-blue-100">
                Kelola inventori, penjualan &amp; keuangan dalam satu dashboard. Dari 1 toko hingga
                50+ outlet.
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <span className="text-lg">✅</span>
                <span className="text-blue-50">2.000+ pengguna aktif</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
                <span className="text-lg">⚡</span>
                <span className="text-blue-50">99.9% uptime</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="/auth/signup"
                className="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-400"
              >
                Coba Gratis 14 Hari
              </a>
              <a
                href="#features"
                className="rounded-lg border-2 border-white/30 px-8 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Lihat Fitur
              </a>
            </div>

            <div className="space-y-3 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div>
                <p className="mb-2 text-sm text-blue-100">
                  Ingin lihat dulu tanpa daftar? Coba dashboard yang sudah terisi 3 bulan data toko
                  frozen food sungguhan — POS, inventori, supplier, sampai laporan keuangan.
                </p>
                <TryDemoButton />
              </div>
              <div className="border-t border-white/20 pt-3">
                <p className="mb-2 text-sm text-blue-100">
                  Khusus ingin coba pengalaman kasirnya saja? Langsung masuk ke Cashier Portal —
                  Kasir, Riwayat, Laporan Harian, Absensi, Checklist, sampai Izin — semua sudah terisi.
                </p>
                <TryPosDemoButton />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
            <div className="space-y-3 rounded-lg bg-white p-6 shadow-xl">
              <div className="h-3 w-1/2 rounded" style={{ background: 'var(--chart-1)', opacity: 0.25 }} />
              <div
                className="h-24 rounded"
                style={{ background: 'linear-gradient(135deg, var(--chart-1), var(--chart-3))', opacity: 0.85 }}
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded" style={{ background: 'var(--chart-3)', opacity: 0.25 }} />
                <div className="h-12 rounded" style={{ background: 'var(--chart-4)', opacity: 0.25 }} />
                <div className="h-12 rounded" style={{ background: 'var(--chart-1)', opacity: 0.25 }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">
            Kenapa Toko Butuh GawEEE?
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-200 border-l-4 p-6" style={{ borderLeftColor: p.color }}>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{p.title}</h3>
                <p className="text-gray-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20" style={{ background: 'var(--brand-50)' }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Fitur Unggulan GawEEE</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${f.color} 18%, white)` }}
                >
                  <span className="text-2xl">{f.icon}</span>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">{f.title}</h3>
                <p className="text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Cara Kerja</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div
                  className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full font-bold text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--brand-900))' }}
                >
                  {i + 1}
                </div>
                <h3 className="mb-1 font-semibold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20" style={{ background: 'var(--brand-50)' }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Pilih Paket yang Sesuai</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => {
              const isHighlighted = 'highlighted' in tier && tier.highlighted
              return (
                <div
                  key={tier.id}
                  className={
                    isHighlighted
                      ? 'scale-105 rounded-xl border-2 p-8 text-white shadow-xl'
                      : 'rounded-xl border border-gray-200 bg-white p-8 transition hover:border-blue-400'
                  }
                  style={
                    isHighlighted
                      ? { background: 'linear-gradient(150deg, var(--brand-700), var(--brand-950))', borderColor: 'var(--brand-500)' }
                      : undefined
                  }
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-2xl font-bold">{tier.name}</h3>
                    {isHighlighted && (
                      <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-blue-900">
                        POPULER
                      </span>
                    )}
                  </div>
                  <p className={isHighlighted ? 'mb-6 text-blue-200' : 'mb-6 text-gray-600'}>{tier.description}</p>
                  <div className="mb-6">
                    {tier.price === null ? (
                      <span className="text-4xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">{formatCurrency(tier.price)}</span>
                        <span className="text-sm opacity-80">/bulan</span>
                      </>
                    )}
                  </div>
                  <ul className="mb-8 space-y-3">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span style={{ color: isHighlighted ? 'var(--status-good)' : undefined }}>✅</span>{' '}
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/auth/signup"
                    className={
                      isHighlighted
                        ? 'block w-full rounded-lg bg-white py-3 text-center font-semibold text-blue-700 transition hover:bg-blue-50'
                        : 'block w-full rounded-lg border-2 border-blue-500 py-3 text-center font-semibold text-blue-500 transition hover:bg-blue-50'
                    }
                  >
                    {tier.price === null ? 'Hubungi Sales' : 'Pilih Paket Ini'}
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Pertanyaan Umum</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="rounded-lg border border-gray-200 border-l-4 p-4" style={{ borderLeftColor: 'var(--brand-500)' }}>
                <summary className="cursor-pointer font-semibold text-gray-900">{faq.q}</summary>
                <p className="mt-2 text-gray-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-blue-200" style={{ background: 'var(--brand-950)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row">
          <span>© {new Date().getFullYear()} GawEEE — PT Berkah Purnama Sewu</span>
          <div className="flex gap-6">
            <a href="/auth/signup" className="hover:text-white">Daftar</a>
            <a href="/auth/login" className="hover:text-white">Masuk</a>
            <a href="#pricing" className="hover:text-white">Harga</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
