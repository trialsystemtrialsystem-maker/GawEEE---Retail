import { SignUpForm } from '@/components/auth/SignUpForm'

export const metadata = { title: 'Daftar | GawEEE' }

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">GawEEE</h1>
          <p className="mt-2 text-gray-600">Daftar Akun Gratis</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
