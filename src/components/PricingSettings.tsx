'use client'
import { useEffect, useState } from 'react'
import { Plus, X, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePricing, useInvalidate, qk, defaultProfile } from '@/lib/queries'
import { Button, Label, Segmented, Select, Sheet } from './ui'
import { PercentInput } from './ProductEditor'
import { useToast, errMsg } from './Toast'

type Form = {
  platform_fee_pct: number
  affiliate_pct: number
  default_markup_pct: number
  fee_basis: 'price' | 'cost_margin'
  price_rounding: number
  sim_steps: number[]
  safe_min_pct: number
  safe_max_pct: number
  target_fast_pct: number
  target_normal_pct: number
  target_slow_pct: number
  promo_min_margin_pct: number
  promo_steps: number[]
  promo_extra_fee_pct: number
}

const KEYS: (keyof Form)[] = [
  'platform_fee_pct',
  'affiliate_pct',
  'default_markup_pct',
  'fee_basis',
  'price_rounding',
  'sim_steps',
  'safe_min_pct',
  'safe_max_pct',
  'target_fast_pct',
  'target_normal_pct',
  'target_slow_pct',
  'promo_min_margin_pct',
  'promo_steps',
  'promo_extra_fee_pct',
]

function pick(src: Record<string, unknown>): Form {
  const f = {} as Record<string, unknown>
  for (const k of KEYS) {
    const v = src[k]
    f[k] = Array.isArray(v) ? v.map(Number) : k === 'fee_basis' ? v : Number(v)
  }
  return f as Form
}

/** Editor daftar persen, mis. kolom simulasi 50/60/…/100. */
function StepsEditor({ value, onChange, max = 500 }: { value: number[]; onChange: (v: number[]) => void; max?: number }) {
  const [add, setAdd] = useState('')
  const push = () => {
    const n = Math.round(Number(add.replace(',', '.')))
    if (!isFinite(n) || n <= 0 || n > max || value.includes(n)) return setAdd('')
    onChange([...value, n].sort((a, b) => a - b))
    setAdd('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1 pl-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
            {s}%
            <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} className="flex size-6 items-center justify-center rounded-full hover:bg-brand-100" aria-label={`Hapus ${s}%`}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center rounded-full bg-white ring-1 ring-ink-200">
          <input
            inputMode="numeric"
            value={add}
            placeholder="+ %"
            onChange={(e) => setAdd(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), push())}
            className="h-8 w-14 bg-transparent pl-3 text-sm outline-none"
          />
          <button type="button" onClick={push} className="flex size-8 items-center justify-center rounded-full text-brand-700" aria-label="Tambah">
            <Plus className="size-4" />
          </button>
        </span>
      </div>
    </div>
  )
}

export default function PricingSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = usePricing()
  const toast = useToast()
  const invalidate = useInvalidate()
  const [f, setF] = useState<Form>(pick(defaultProfile as unknown as Record<string, unknown>))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setF(pick(profile as unknown as Record<string, unknown>))
  }, [open, profile])
  const set = (p: Partial<Form>) => setF({ ...f, ...p })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Pengaturan harga & simulasi"
      footer={
        <Button
          block
          loading={busy}
          onClick={async () => {
            if (!f.sim_steps.length || !f.promo_steps.length) return toast('Minimal satu persen di tiap daftar simulasi', 'error')
            if (f.safe_min_pct >= f.safe_max_pct) return toast('Batas aman bawah harus lebih kecil dari batas atas', 'error')
            setBusy(true)
            const { error } = await supabase.from('store_settings').update(f).eq('id', 1)
            setBusy(false)
            if (error) return toast(errMsg(error), 'error')
            await invalidate(qk.profile)
            toast('Pengaturan harga tersimpan')
            onClose()
          }}
        >
          Simpan pengaturan
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-sm font-bold text-ink-900">Potongan marketplace</h4>
          <div className="grid grid-cols-2 gap-3">
            <PercentInput label="Potongan platform" value={f.platform_fee_pct} onChange={(n) => set({ platform_fee_pct: n ?? 0 })} />
            <PercentInput label="Komisi affiliate" value={f.affiliate_pct} onChange={(n) => set({ affiliate_pct: n ?? 0 })} />
          </div>
          <div>
            <Label>Cara menghitung potongan</Label>
            <Segmented
              value={f.fee_basis}
              onChange={(v) => set({ fee_basis: v })}
              options={[
                { value: 'price', label: 'Dari harga jual' },
                { value: 'cost_margin', label: 'Seperti Excel' },
              ]}
            />
            <p className="mt-1.5 text-xs text-ink-500">
              {f.fee_basis === 'price'
                ? 'Disarankan. Marketplace memotong dari harga jual, jadi harga dinaikkan agar laba tetap sesuai margin.'
                : 'Potongan = (modal + margin) × %. Sama dengan file simulasi, tapi laba nyata sedikit lebih kecil.'}
            </p>
          </div>
        </section>

        <section className="space-y-3 border-t border-ink-100 pt-4">
          <h4 className="text-sm font-bold text-ink-900">Simulasi harga jual</h4>
          <div>
            <Label hint="margin dari modal">Kolom simulasi</Label>
            <StepsEditor value={f.sim_steps} onChange={(v) => set({ sim_steps: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PercentInput label="Batas aman bawah" max={500} value={f.safe_min_pct} onChange={(n) => set({ safe_min_pct: n ?? 0 })} />
            <PercentInput label="Batas aman atas" max={500} value={f.safe_max_pct} onChange={(n) => set({ safe_max_pct: n ?? 0 })} />
          </div>
          <div>
            <Label hint="dipakai untuk saran harga">Target margin per kecepatan jual</Label>
            <div className="grid grid-cols-3 gap-2">
              <PercentInput label="Laris" max={500} value={f.target_fast_pct} onChange={(n) => set({ target_fast_pct: n ?? 0 })} />
              <PercentInput label="Normal" max={500} value={f.target_normal_pct} onChange={(n) => set({ target_normal_pct: n ?? 0 })} />
              <PercentInput label="Lambat" max={500} value={f.target_slow_pct} onChange={(n) => set({ target_slow_pct: n ?? 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PercentInput label="Markup awal produk baru" max={500} value={f.default_markup_pct} onChange={(n) => set({ default_markup_pct: n ?? 0 })} />
            <Select label="Pembulatan harga" value={f.price_rounding} onChange={(e) => set({ price_rounding: Number(e.target.value) })}>
              <option value={0}>Tidak</option>
              <option value={100}>Per Rp 100</option>
              <option value={500}>Per Rp 500</option>
              <option value={1000}>Per Rp 1.000</option>
            </Select>
          </div>
        </section>

        <section className="space-y-3 border-t border-ink-100 pt-4">
          <h4 className="text-sm font-bold text-ink-900">Simulasi promo (flash sale & voucher)</h4>
          <div>
            <Label>Kolom diskon</Label>
            <StepsEditor value={f.promo_steps} onChange={(v) => set({ promo_steps: v })} max={90} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PercentInput label="Laba minimal saat promo" max={500} value={f.promo_min_margin_pct} onChange={(n) => set({ promo_min_margin_pct: n ?? 0 })} />
            <PercentInput label="Biaya program promo" value={f.promo_extra_fee_pct} onChange={(n) => set({ promo_extra_fee_pct: n ?? 0 })} />
          </div>
          <p className="text-xs text-ink-500">
            Laba minimal dihitung dari modal. Biaya program promo = potongan tambahan dari marketplace saat ikut promo (isi 0 jika tidak ada).
          </p>
        </section>

        <button
          type="button"
          onClick={() => setF({ ...pick(defaultProfile as unknown as Record<string, unknown>), platform_fee_pct: f.platform_fee_pct, affiliate_pct: f.affiliate_pct })}
          className="flex items-center gap-1.5 text-sm font-semibold text-ink-500"
        >
          <RotateCcw className="size-4" /> Kembalikan persen simulasi ke bawaan
        </button>
      </div>
    </Sheet>
  )
}
