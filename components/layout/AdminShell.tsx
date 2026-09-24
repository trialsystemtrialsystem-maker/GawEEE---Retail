'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ADMIN_HUB_SECTIONS, MASTER_DATA_SECTIONS } from '@/lib/nav/adminHub'

// Master Admin's own frame: deliberately unlike the transactional app (dark
// slate, "Mode Konfigurasi" banner, no module tabs, no POS link, no
// notifications). Everything in the sidebar stays under /dashboard/admin, so
// editing a setting never navigates the owner into another module.
function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const sections = [...ADMIN_HUB_SECTIONS.filter((s) => s.title !== 'Data Master'), ...MASTER_DATA_SECTIONS.map((s) => ({ ...s, title: `Data: ${s.title}` }))]
  const link = (href: string, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
    return `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? 'bg-amber-400 font-semibold text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`
  }
  return (
    <nav aria-label="Navigasi Master Admin" className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-lg font-bold text-white">Master Admin</p>
        <p className="text-xs text-amber-300">Mode Konfigurasi</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <Link href="/dashboard/admin" onClick={onNavigate} className={link('/dashboard/admin', true)}>
          <span aria-hidden>🏠</span> Pusat Kendali
        </Link>
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.title}</p>
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} onClick={onNavigate} className={link(item.href)}>
                <span aria-hidden>{item.icon}</span> {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}

export function AdminShell({ userName, children }: { userName?: string; children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <div className="hidden w-64 shrink-0 md:block">
        <AdminNav />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-50 h-full w-64">
            <AdminNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b-2 border-amber-400 bg-white px-4 py-3 shadow-sm">
          <button type="button" onClick={() => setOpen(true)} className="rounded p-2 text-slate-800 hover:bg-slate-100 md:hidden" aria-label="Buka menu">
            ☰
          </button>
          <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 md:inline">
            Anda berada di area konfigurasi sistem — bukan transaksi
          </span>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              ← Kembali ke Aplikasi
            </Link>
            {userName && <span className="text-sm text-slate-700">{userName}</span>}
            <button type="button" onClick={logout} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600">
              Keluar
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
