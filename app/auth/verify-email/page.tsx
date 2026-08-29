export const metadata = { title: 'Verifikasi Email | GawEEE' }

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Cek Email Anda</h1>
        <p className="text-gray-600">
          Kami telah mengirimkan tautan verifikasi ke email Anda. Klik tautan tersebut untuk
          mengaktifkan akun, lalu masuk untuk mulai menggunakan GawEEE.
        </p>
        <a href="/auth/login" className="inline-block text-blue-500 hover:underline">
          Kembali ke halaman masuk
        </a>
      </div>
    </div>
  )
}
