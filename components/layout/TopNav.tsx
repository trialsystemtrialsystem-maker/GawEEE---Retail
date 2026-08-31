'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV, SECONDARY_NAV, findActiveNavItem } from '@/lib/nav/config'

export function TopNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const activeItem = findActiveNavItem(pathname)
  const activeInSecondary = SECONDARY_NAV.some((item) => item.key === activeItem?.key)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav aria-label="Navigasi modul" className="flex items-center gap-1 overflow-x-auto">
      {PRIMARY_NAV.map((item) => {
        const isActive = activeItem?.key === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {item.label}
          </Link>
        )
      })}

      <div ref={moreRef} className="relative">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeInSecondary ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
          }`}
        >
          More ▾
        </button>
        {moreOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {SECONDARY_NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-2 px-4 py-2 text-sm ${
                  activeItem?.key === item.key ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
