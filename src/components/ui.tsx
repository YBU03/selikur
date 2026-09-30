'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { forwardRef, useEffect, useState, useTransition } from 'react'
import { ChevronLeft, Loader2, Minus, Plus, X, Package } from 'lucide-react'
import { photoUrl } from '@/lib/supabase'
import type { StockStatus } from '@/lib/forecast'
import { STOCK_LABEL } from '@/lib/forecast'

export const cx = clsx

type BtnVariant = 'primary' | 'accent' | 'soft' | 'ghost' | 'outline' | 'danger'
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-lift',
  accent: 'bg-sun-500 text-white hover:bg-sun-600 active:bg-sun-700 shadow-sun',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  ghost: 'text-ink-700 hover:bg-ink-100',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
}

export function buttonClass(variant: BtnVariant = 'primary', size: 'sm' | 'md' | 'lg' = 'md', block?: boolean) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    size === 'sm' && 'h-9 px-3.5 text-sm',
    size === 'md' && 'h-12 px-5 text-[15px]',
    size === 'lg' && 'h-14 px-6 text-base',
    block && 'w-full',
    btnStyles[variant],
  )
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
}: {
  href: string
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size, block), className)}>
      {children}
    </Link>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  block,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  block?: boolean
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(buttonClass(variant, size, block), className)}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-ink-100 active:scale-95 disabled:opacity-40',
        className,
      )}
    />
  )
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: boolean | string
  action?: React.ReactNode
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 bg-ink-50/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 lg:-mx-8 lg:mb-6 lg:px-8 lg:pt-6">
      {back && (
        <IconButton
          aria-label="Kembali"
          className="-ml-2"
          onClick={() => (typeof back === 'string' ? router.push(back) : router.back())}
        >
          <ChevronLeft className="size-6" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink-900 lg:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx('rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100', className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold tracking-wide text-ink-500 uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink-700">
      {children}
      {hint && <span className="text-xs font-normal text-ink-400">{hint}</span>}
    </span>
  )
}

const inputCls =
  'h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: React.ReactNode }>(
  function Input({ label, hint, className, ...p }, ref) {
    const el = <input ref={ref} {...p} className={cx(inputCls, className)} />
    if (!label) return el
    return (
      <label className="block">
        <Label hint={hint}>{label}</Label>
        {el}
      </label>
    )
  },
)

export function Textarea({ label, className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const el = <textarea {...p} className={cx(inputCls, 'h-auto min-h-24 py-3', className)} />
  if (!label) return el
  return (
    <label className="block">
      <Label>{label}</Label>
      {el}
    </label>
  )
}

export function Select({
  label,
  className,
  children,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const el = (
    <select
      {...p}
      className={cx(
        inputCls,
        "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%236c766f' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:20px] bg-[right_0.9rem_center] bg-no-repeat pr-10",
        className,
      )}
    >
      {children}
    </select>
  )
  if (!label) return el
  return (
    <label className="block">
      <Label>{label}</Label>
      {el}
    </label>
  )
}

/** Input angka dengan format ribuan (Rupiah). */
export function MoneyInput({
  value,
  onChange,
  label,
  placeholder = '0',
  autoFocus,
  className,
}: {
  value: number | null | undefined
  onChange: (n: number) => void
  label?: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const fmt = (n: number | null | undefined) => (n ? new Intl.NumberFormat('id-ID').format(n) : '')
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    setText((t) => (Number(t.replace(/\D/g, '')) === (value || 0) ? t : fmt(value)))
  }, [value])
  const el = (
    <div className={cx('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-medium text-ink-400">Rp</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          const n = Number(digits || 0)
          setText(digits ? new Intl.NumberFormat('id-ID').format(n) : '')
          onChange(n)
        }}
        className={cx(inputCls, 'pl-11 tabular-nums')}
      />
    </div>
  )
  if (!label) return el
  return (
    <label className="block">
      <Label>{label}</Label>
      {el}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  label,
  step = 1,
  min = 0,
  hint,
  compact,
}: {
  value: number | null | undefined
  onChange: (n: number) => void
  label?: string
  step?: number
  min?: number
  hint?: React.ReactNode
  compact?: boolean
}) {
  const v = Number(value) || 0
  const el = (
    <div className={cx('flex items-center rounded-2xl border border-ink-200 bg-white', compact ? 'h-10' : 'h-12')}>
      <button type="button" className="flex h-full w-11 items-center justify-center text-ink-500 active:text-brand-700" onClick={() => onChange(Math.max(min, v - step))} aria-label="Kurangi">
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d-]/g, ''))
          onChange(isFinite(n) ? n : 0)
        }}
        className="h-full w-full min-w-0 bg-transparent text-center font-semibold tabular-nums outline-none"
      />
      <button type="button" className="flex h-full w-11 items-center justify-center text-ink-500 active:text-brand-700" onClick={() => onChange(v + step)} aria-label="Tambah">
        <Plus className="size-4" />
      </button>
    </div>
  )
  if (!label) return el
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      {el}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
}) {
  // Tombol langsung terlihat aktif; isi halaman yang berat dirender sebagai transisi (tidak memblok tap)
  const [shown, setShown] = useState(value)
  const [, startTransition] = useTransition()
  useEffect(() => setShown(value), [value])
  return (
    <div className={cx('flex rounded-2xl bg-ink-100 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            if (o.value === shown) return
            setShown(o.value)
            startTransition(() => onChange(o.value))
          }}
          className={cx(
            'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150',
            shown === o.value ? 'bg-white text-brand-800 shadow-soft' : 'text-ink-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150',
        active ? 'bg-brand-700 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200',
      )}
    >
      {children}
    </button>
  )
}

const badgeTone = {
  green: 'bg-brand-50 text-brand-700 ring-brand-100',
  orange: 'bg-sun-50 text-sun-700 ring-sun-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  gray: 'bg-ink-100 text-ink-600 ring-ink-200',
  leaf: 'bg-leaf-500/10 text-leaf-600 ring-leaf-500/20',
}
export function Badge({ tone = 'gray', children, className }: { tone?: keyof typeof badgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', badgeTone[tone], className)}>
      {children}
    </span>
  )
}

export function StockBadge({ status }: { status: StockStatus }) {
  const tone = status === 'kritis' ? 'red' : status === 'perlu' ? 'orange' : 'green'
  return (
    <Badge tone={tone}>
      <span className={cx('size-1.5 rounded-full', status === 'kritis' ? 'bg-red-500' : status === 'perlu' ? 'bg-sun-500' : 'bg-brand-500')} />
      {STOCK_LABEL[status]}
    </Badge>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="animate-fade absolute inset-0 bg-ink-900/45" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-lift sm:rounded-3xl">
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-200 sm:hidden" />
          <h3 className="mt-2 flex-1 text-lg font-bold">{title}</h3>
          <IconButton onClick={onClose} aria-label="Tutup" className="mt-2 -mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-ink-100 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon = Package,
  title,
  text,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  text?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-7" />
      </div>
      <p className="font-semibold text-ink-800">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-brand-600', className)} />
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500">
      <Spinner /> {label}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-ink-100', className)} />
}

export function Thumb({ path, size = 48, className, alt = '' }: { path?: string | null; size?: number; className?: string; alt?: string }) {
  const url = photoUrl(path)
  return (
    <div
      className={cx('shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-ink-100 ring-1 ring-ink-100', className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-brand-300">
          <Package style={{ width: size * 0.42, height: size * 0.42 }} />
        </div>
      )}
    </div>
  )
}

export function LinkRow({
  href,
  icon: Icon,
  title,
  text,
  tone = 'brand',
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  text?: string
  tone?: 'brand' | 'sun' | 'leaf' | 'ink'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    sun: 'bg-sun-50 text-sun-600',
    leaf: 'bg-leaf-500/10 text-leaf-600',
    ink: 'bg-ink-100 text-ink-700',
  }
  return (
    <Link href={href} className="flex items-center gap-3.5 rounded-2xl p-3 transition hover:bg-ink-50 active:scale-[0.99]">
      <div className={cx('flex size-11 items-center justify-center rounded-2xl', tones[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink-900">{title}</p>
        {text && <p className="truncate text-sm text-ink-500">{text}</p>}
      </div>
    </Link>
  )
}

export function Toggle({ checked, onChange, label, text }: { checked: boolean; onChange: (v: boolean) => void; label: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-800">{label}</p>
        {text && <p className="text-xs text-ink-500">{text}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-ink-200')}
      >
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </label>
  )
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Hapus',
  loading,
  requireWord = 'Hapus',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  text?: string
  confirmLabel?: string
  loading?: boolean
  /** Kata yang harus diketik untuk mengonfirmasi; null = tanpa ketik. */
  requireWord?: string | null
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  const ok = !requireWord || typed.trim().toLowerCase() === requireWord.toLowerCase()
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="text-ink-600">{text}</p>}
      {requireWord && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm text-ink-600">
            Ketik <b className="text-red-600">{requireWord}</b> untuk mengonfirmasi
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireWord}
            autoCapitalize="off"
            autoComplete="off"
            className={cx(inputCls, ok && typed ? 'border-red-400 ring-4 ring-red-50' : '')}
          />
        </label>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="danger"
          disabled={!ok}
          loading={loading || busy}
          className={ok ? 'bg-red-600 text-white hover:bg-red-700' : ''}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
