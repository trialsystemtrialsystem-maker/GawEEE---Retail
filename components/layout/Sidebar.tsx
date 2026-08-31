'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV, SECONDARY_NAV, findActiveNavItem, type NavGroup } from '@/lib/nav/config'

function SidebarAccordion({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  const matchingGroup = groups.find((g) => g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '?')))?.label ?? null
  const [openGroup, setOpenGroup] = useState<string | null>(matchingGroup)
  const [trackedPathname, setTrackedPathname] = useState(pathname)

  // Re-open whichever group contains the route after client-side navigation
  // (e.g. following a link from elsewhere into a group's page should
  // auto-expand it) — adjusted during render rather than an effect, per
  // React's guidance for resetting state on a prop change.
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname)
    if (matchingGroup) setOpenGroup(matchingGroup)
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isOpen = openGroup === group.label
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.label)}
              aria-expanded={isOpen}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isOpen ? 'bg-white/10 text-white' : 'text-blue-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{group.icon}</span>
                {group.label}
              </span>
              <span aria-hidden className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="ml-4 space-y-0.5 border-l border-white/10 pl-3 py-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      pathname === item.href
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40'
                        : 'text-blue-200/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

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
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div>
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
              ) : !activeItem.groups ? (
                <p className="px-3 text-sm text-blue-200/60">Tidak ada sub-menu.</p>
              ) : null}
            </div>

            {activeItem.groups && <SidebarAccordion groups={activeItem.groups} pathname={pathname} onNavigate={onNavigate} />}
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
