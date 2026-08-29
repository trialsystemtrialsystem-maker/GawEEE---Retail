'use client'

import { useRouter } from 'next/navigation'

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
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded p-2 hover:bg-gray-100 md:hidden"
        aria-label="Buka menu"
      >
        ☰
      </button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {userName && <span className="text-sm text-gray-700">{userName}</span>}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Keluar
        </button>
      </div>
    </header>
  )
}
