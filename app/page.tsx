import { PRICING_TIERS } from '@/lib/utils/constants'
import { formatCurrency } from '@/lib/utils/formatting'

const FEATURES = [
  { icon: '🛒', title: 'Real-time POS', desc: 'Proses transaksi cepat dengan barcode scanning dan multiple payment methods.' },
  { icon: '📦', title: 'Inventory Management', desc: 'Tracking stok real-time dengan otomatis alert ketika stock habis.' },
  { icon: '📊', title: 'Financial Reports', desc: 'Daily P&L, cash position, dan tax reports yang siap audit.' },
  { icon: '🏬', title: 'Multi-outlet Support', desc: 'Kelola 1 sampai 50+ outlet dari satu Master Admin Panel.' },
  { icon: '💳', title: 'Payment Integration', desc: 'E-wallet (OVO, Dana, Gopay) dan Virtual Account bank langsung terintegrasi.' },
  { icon: '✅', title: 'Compliance Ready', desc: 'Audit trail, tax reporting, dan invoice archiving otomatis.' },
]

const PAIN_POINTS = [
  { title: 'Spreadsheet Chaos', desc: 'Data tersebar, tidak real-time, rawan human error.' },
  { title: 'Masalah Inventori', desc: 'Stok kosong mendadak atau overstock yang menumpuk modal.' },
  { title: 'Rekonsiliasi Manual', desc: 'Menghabiskan waktu berjam-jam mencocokkan kas dan transaksi.' },
  { title: 'Tanpa Visibilitas', desc: 'Tidak ada data tren untuk mengambil keputusan bisnis.' },
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
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white pb-20 pt-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 md:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
                Sistem ERP untuk Toko Retail Anda
              </h1>
              <p className="text-xl leading-relaxed text-gray-600">
                Kelola inventori, penjualan &amp; keuangan dalam satu dashboard. Dari 1 toko hingga
                50+ outlet.
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <span className="text-gray-700">2.000+ pengguna aktif</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <span className="text-gray-700">99.9% uptime</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="/auth/signup"
                className="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white transition hover:bg-blue-600"
              >
                Coba Gratis 14 Hari
              </a>
              <a
                href="#features"
                className="rounded-lg border-2 border-blue-500 px-8 py-3 font-semibold text-blue-500 transition hover:bg-blue-50"
              >
                Lihat Fitur
              </a>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-8 shadow-xl">
            <div className="space-y-3 rounded-lg bg-white p-6 shadow">
              <div className="h-3 w-1/2 rounded bg-gray-200" />
              <div className="h-24 rounded bg-blue-100" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded bg-emerald-100" />
                <div className="h-12 rounded bg-amber-100" />
                <div className="h-12 rounded bg-blue-100" />
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
              <div key={p.title} className="rounded-xl border border-gray-200 p-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{p.title}</h3>
                <p className="text-gray-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Fitur Unggulan GawEEE</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 bg-white p-6 transition hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
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
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
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
      <section id="pricing" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Pilih Paket yang Sesuai</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={
                  'highlighted' in tier && tier.highlighted
                    ? 'scale-105 rounded-xl border-2 border-blue-500 bg-blue-500 p-8 text-white'
                    : 'rounded-xl border border-gray-200 bg-white p-8 transition hover:border-blue-500'
                }
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-2xl font-bold">{tier.name}</h3>
                  {'highlighted' in tier && tier.highlighted && (
                    <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-blue-900">
                      POPULER
                    </span>
                  )}
                </div>
                <p className={'highlighted' in tier && tier.highlighted ? 'mb-6 text-blue-100' : 'mb-6 text-gray-600'}>
                  {tier.description}
                </p>
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
                      <span>✅</span> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/auth/signup"
                  className={
                    'highlighted' in tier && tier.highlighted
                      ? 'block w-full rounded-lg bg-white py-3 text-center font-semibold text-blue-500 transition hover:bg-blue-50'
                      : 'block w-full rounded-lg border-2 border-blue-500 py-3 text-center font-semibold text-blue-500 transition hover:bg-blue-50'
                  }
                >
                  {tier.price === null ? 'Hubungi Sales' : 'Pilih Paket Ini'}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="mb-16 text-center text-3xl font-bold text-gray-900">Pertanyaan Umum</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="rounded-lg border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-gray-900">{faq.q}</summary>
                <p className="mt-2 text-gray-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-gray-600 sm:flex-row">
          <span>© {new Date().getFullYear()} GawEEE — PT Berkah Purnama Sewu</span>
          <div className="flex gap-6">
            <a href="/auth/signup" className="hover:text-blue-500">Daftar</a>
            <a href="/auth/login" className="hover:text-blue-500">Masuk</a>
            <a href="#pricing" className="hover:text-blue-500">Harga</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
