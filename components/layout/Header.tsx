'use client'

import { useRouter } from 'next/navigation'
import { TopNav } from '@/components/layout/TopNav'

export function Header({
  userName,
  onMenuClick,
}: {
  userName?: string
  onMenuClick?: () => void
}) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b-2 border-blue-500/20 bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded p-2 text-blue-900 hover:bg-blue-50 md:hidden"
        aria-label="Buka menu"
      >
        ☰
      </button>

      <div className="hidden md:block">
        <TopNav />
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
            {userName}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600"
        >
          Keluar
        </button>
      </div>
    </header>
  )
}
