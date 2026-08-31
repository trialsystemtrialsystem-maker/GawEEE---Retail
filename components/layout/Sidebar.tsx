'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV, SECONDARY_NAV, findActiveNavItem } from '@/lib/nav/config'

export function Sidebar({ outletName, onNavigate }: { outletName?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const activeItem = findActiveNavItem(pathname)

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex h-full flex-col text-blue-100"
      style={{ background: 'linear-gradient(180deg, var(--brand-900), var(--brand-950))' }}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-lg font-bold text-white">GawEEE</p>
        {outletName && <p className="truncate text-xs text-blue-300">{outletName}</p>}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        <Link
          href="/pos"
          onClick={onNavigate}
          aria-current={pathname === '/pos' ? 'page' : undefined}
          className={`mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === '/pos'
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40'
              : 'text-blue-200 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span aria-hidden>🛒</span>
          Kasir (POS)
        </Link>

        {/* On desktop, section-switching lives in the TopNav pill bar (Header)
            instead — this block only appears in the mobile drawer, since the
            TopNav row itself is desktop-only (md:block). */}
        <div className="space-y-1 border-t border-white/10 pt-3 md:hidden">
          {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => {
            const isActive = activeItem?.key === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40' : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>

        {activeItem && (
          <div className="border-t border-white/10 pt-3">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-blue-300">{activeItem.label}</p>
            {activeItem.children && activeItem.children.length > 0 ? (
              <div className="space-y-1">
                {activeItem.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={pathname === child.href ? 'page' : undefined}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      pathname === child.href
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40'
                        : 'text-blue-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-3 text-sm text-blue-200/60">Tidak ada sub-menu.</p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <a href="/dashboard/help" className="block text-sm text-blue-200 hover:text-white">
          ❓ Help &amp; Support
        </a>
      </div>
    </nav>
  )
}
