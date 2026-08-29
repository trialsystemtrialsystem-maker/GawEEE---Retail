type Variant = 'success' | 'warning' | 'danger' | 'info'

const variantClasses: Record<Variant, string> = {
  success: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-500 bg-amber-50 text-amber-800',
  danger: 'border-red-500 bg-red-50 text-red-800',
  info: 'border-blue-500 bg-blue-50 text-blue-800',
}

export function Alert({ variant = 'info', children }: { variant?: Variant; children: React.ReactNode }) {
  return (
    <div role="alert" aria-live="polite" className={`rounded-md border-l-4 p-3 text-sm ${variantClasses[variant]}`}>
      {children}
    </div>
  )
}
