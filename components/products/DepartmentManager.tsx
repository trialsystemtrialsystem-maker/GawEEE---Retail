'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNotificationStore } from '@/store/notificationStore'

interface Department {
  id: string
  name: string
  sort_order: number
}
interface Category {
  id: string
  name: string
  department_id: string | null
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newDeptName, setNewDeptName] = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [isSubmittingDept, setIsSubmittingDept] = useState(false)
  const [isSubmittingCat, setIsSubmittingCat] = useState(false)
  const showToast = useNotificationStore((s) => s.show)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [deptRes, catRes] = await Promise.all([fetch('/api/product-departments'), fetch('/api/product-categories')])
    const deptData = await deptRes.json()
    const catData = await catRes.json()
    if (deptRes.ok) setDepartments(deptData.departments ?? [])
    if (catRes.ok) setCategories(catData.categories ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 0)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmittingDept(true)
    try {
      const res = await fetch('/api/product-departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName }),
      })
      if (res.ok) {
        setNewDeptName('')
        load()
      }
    } finally {
      setIsSubmittingDept(false)
    }
  }

  async function handleDeleteDepartment(id: string) {
    const ok = window.confirm('Hapus departemen ini? Kategori di dalamnya akan menjadi tanpa departemen.')
    if (!ok) return
    await fetch(`/api/product-departments/${id}`, { method: 'DELETE' })
    load()
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmittingCat(true)
    try {
      const res = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName }),
      })
      if (res.ok) {
        setNewCatName('')
        showToast('Kategori ditambahkan', 'success')
        load()
      }
    } finally {
      setIsSubmittingCat(false)
    }
  }

  async function handleAssignDepartment(categoryId: string, departmentId: string) {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, department_id: departmentId || null } : c)))
    await fetch(`/api/product-categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_id: departmentId || null }),
    })
  }

  if (isLoading) return <p className="py-8 text-center text-sm text-gray-400">Memuat…</p>

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Departemen</h2>
        <form onSubmit={handleAddDepartment} className="flex gap-2">
          <Input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="Nama departemen" required className="flex-1" />
          <Button type="submit" size="sm" isLoading={isSubmittingDept}>+ Tambah</Button>
        </form>
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
          {departments.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-gray-400">Belum ada departemen</li>
          ) : (
            departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{d.name}</span>
                <button type="button" onClick={() => handleDeleteDepartment(d.id)} className="text-xs text-red-500 hover:underline">
                  Hapus
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Kategori &amp; Penempatan Departemen</h2>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nama kategori baru" required className="flex-1" />
          <Button type="submit" size="sm" isLoading={isSubmittingCat}>+ Tambah</Button>
        </form>
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
          {categories.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-gray-400">Belum ada kategori</li>
          ) : (
            categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <select
                  value={c.department_id ?? ''}
                  onChange={(e) => handleAssignDepartment(c.id, e.target.value)}
                  className="rounded-sm border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tanpa departemen</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
