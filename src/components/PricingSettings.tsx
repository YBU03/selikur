'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePricing, useInvalidate, qk } from '@/lib/queries'
import { Button, Label, Segmented, Select, Sheet } from './ui'
import { PercentInput } from './ProductEditor'
import { useToast, errMsg } from './Toast'

export default function PricingSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = usePricing()
  const toast = useToast()
  const invalidate = useInvalidate()
  const [f, setF] = useState({ platform_fee_pct: 20, affiliate_pct: 0, default_markup_pct: 50, fee_basis: 'price' as 'price' | 'cost_margin', price_rounding: 0 })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open)
      setF({
        platform_fee_pct: Number(profile.platform_fee_pct),
        affiliate_pct: Number(profile.affiliate_pct),
        default_markup_pct: Number(profile.default_markup_pct),
        fee_basis: profile.fee_basis,
        price_rounding: Number(profile.price_rounding),
      })
  }, [open, profile])
  return (
    <Sheet open={open} onClose={onClose} title="Pengaturan harga jual">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <PercentInput label="Potongan platform" value={f.platform_fee_pct} onChange={(n) => setF({ ...f, platform_fee_pct: n ?? 0 })} />
          <PercentInput label="Komisi affiliate" value={f.affiliate_pct} onChange={(n) => setF({ ...f, affiliate_pct: n ?? 0 })} />
        </div>
        <PercentInput label="Markup awal (untuk produk baru)" value={f.default_markup_pct} onChange={(n) => setF({ ...f, default_markup_pct: n ?? 0 })} />
        <div>
          <Label>Cara menghitung potongan</Label>
          <Segmented
            value={f.fee_basis}
            onChange={(v) => setF({ ...f, fee_basis: v })}
            options={[
              { value: 'price', label: 'Dari harga jual' },
              { value: 'cost_margin', label: 'Seperti Excel' },
            ]}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            {f.fee_basis === 'price'
              ? 'Disarankan. Marketplace memotong dari harga jual, jadi harga dinaikkan agar laba tetap sesuai markup.'
              : 'Potongan = (modal + margin) × %. Hasilnya sama dengan file simulasi, tapi laba nyata sedikit lebih kecil.'}
          </p>
        </div>
        <Select label="Pembulatan harga jual" value={f.price_rounding} onChange={(e) => setF({ ...f, price_rounding: Number(e.target.value) })}>
          <option value={0}>Tidak dibulatkan</option>
          <option value={100}>Ke atas per Rp 100</option>
          <option value={500}>Ke atas per Rp 500</option>
          <option value={1000}>Ke atas per Rp 1.000</option>
        </Select>
        <Button
          block
          loading={busy}
          onClick={async () => {
            setBusy(true)
            const { error } = await supabase.from('store_settings').update(f).eq('id', 1)
            setBusy(false)
            if (error) return toast(errMsg(error), 'error')
            await invalidate(qk.profile)
            toast('Pengaturan harga tersimpan')
            onClose()
          }}
        >
          Simpan
        </Button>
        <p className="text-xs text-ink-500">Potongan & komisi bisa dibedakan per produk di halaman detail produk.</p>
      </div>
    </Sheet>
  )
}
