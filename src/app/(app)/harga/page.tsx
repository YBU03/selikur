'use client'
import { useMemo, useState } from 'react'
import { Calculator, Settings2, Search, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCatalog, usePricing, useInvalidate, qk } from '@/lib/queries'
import { breakdown, MARKUP_PRESETS, priceFromMarkup, pricingCfg, type PricingCfg } from '@/lib/pricing'
import { num, pct, rupiah } from '@/lib/format'
import type { Product } from '@/lib/types'
import { Button, Card, Input, MoneyInput, PageHeader, SectionTitle, Segmented, Sheet, Thumb, cx, Loading } from '@/components/ui'
import { PriceBreakdown } from '@/components/PriceSetter'
import PricingSettings from '@/components/PricingSettings'
import { useToast, errMsg } from '@/components/Toast'

function SimTable({ cost, cfg, selected, onPick }: { cost: number; cfg: PricingCfg; selected?: number | null; onPick?: (m: number) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="text-left text-[11px] text-ink-500 uppercase">
            <th className="px-1 py-1.5 font-semibold">Markup</th>
            <th className="px-1 py-1.5 text-right font-semibold">Harga jual</th>
            <th className="px-1 py-1.5 text-right font-semibold">Potongan</th>
            <th className="px-1 py-1.5 text-right font-semibold">Laba/pcs</th>
          </tr>
        </thead>
        <tbody>
          {MARKUP_PRESETS.map((m) => {
            const sell = priceFromMarkup(cost, m, cfg)
            const b = breakdown(cost, sell, cfg)
            const on = selected === m
            return (
              <tr
                key={m}
                onClick={() => onPick?.(m)}
                className={cx('border-t border-ink-100', onPick && 'cursor-pointer', on && 'bg-brand-50')}
              >
                <td className="px-1 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    {on && <Check className="size-3.5 text-brand-700" />}
                    {m}%
                  </span>
                </td>
                <td className="px-1 py-2 text-right font-bold tabular-nums">{rupiah(sell)}</td>
                <td className="px-1 py-2 text-right text-red-600 tabular-nums">{rupiah(b.fee + b.affiliate)}</td>
                <td className={cx('px-1 py-2 text-right font-semibold tabular-nums', b.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>{rupiah(b.profit)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function HargaPage() {
  const profile = usePricing()
  const { data: products, isPending } = useCatalog()
  const [cost, setCost] = useState(50000)
  const [sell, setSell] = useState(0)
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(false)
  const [pick, setPick] = useState<Product | null>(null)
  const cfg = pricingCfg(profile)

  const rows = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.variants.length && p.status !== 'inactive')
        .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
        .map((p) => {
          const v = p.variants[0]
          const c = pricingCfg(profile, p)
          return { p, v, b: breakdown(v.buy_price, v.sell_price, c), mixed: p.variants.some((x) => x.sell_price !== v.sell_price || x.buy_price !== v.buy_price) }
        })
        .sort((a, b) => (a.b.marginOnCost ?? 0) - (b.b.marginOnCost ?? 0)),
    [products, q, profile],
  )
  const lowCount = rows.filter((r) => r.b.profit <= 0 || (r.b.marginOnCost ?? 0) < 0.3).length

  return (
    <div>
      <PageHeader
        title="Harga Jual & Margin"
        subtitle="Simulasi markup, potongan platform, affiliate"
        back="/menu"
        action={
          <Button size="sm" variant="soft" onClick={() => setSettings(true)}>
            <Settings2 className="size-4" /> Atur
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['Platform', `${num(cfg.feePct, 1)}%`],
          ['Affiliate', `${num(cfg.affiliatePct, 1)}%`],
          ['Markup awal', `${num(profile.default_markup_pct)}%`],
        ].map(([k, v]) => (
          <button key={k} onClick={() => setSettings(true)} className="rounded-2xl bg-white py-2.5 text-center shadow-soft ring-1 ring-ink-100">
            <p className="text-lg font-bold text-brand-800">{v}</p>
            <p className="text-[11px] text-ink-500">{k}</p>
          </button>
        ))}
      </div>

      <Card>
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Calculator className="size-5 text-brand-600" /> Kalkulator cepat
        </p>
        <MoneyInput label="Harga kulakan (modal)" value={cost} onChange={setCost} />
        <div className="mt-3">
          <SimTable cost={cost} cfg={cfg} />
        </div>
        <div className="mt-4 border-t border-ink-100 pt-4">
          <MoneyInput label="Atau tulis harga jual sendiri" value={sell} onChange={setSell} />
          {sell > 0 && cost > 0 && (
            <div className="mt-3">
              <PriceBreakdown cost={cost} sell={sell} cfg={cfg} />
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-500">
          {cfg.basis === 'price'
            ? 'Harga jual = modal × (1 + markup) ÷ (1 − potongan − affiliate), jadi laba setelah dipotong tetap sesuai markup.'
            : 'Harga jual = modal × (1 + markup) × (1 + potongan + affiliate), sama seperti rumus Excel simulasi.'}
        </p>
      </Card>

      <SectionTitle>Margin per produk {lowCount > 0 && <span className="ml-1 text-sun-600 normal-case">· {lowCount} perlu dicek</span>}</SectionTitle>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
        <Input className="pl-11" placeholder="Cari produk" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isPending && <Loading />}
      <div className="space-y-2">
        {rows.map(({ p, v, b, mixed }) => (
          <button key={p.id} onClick={() => setPick(p)} className="block w-full text-left">
            <Card className="flex items-center gap-3 p-3 transition active:scale-[0.99]">
              <Thumb path={p.photos[0]} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-ink-500">
                  {rupiah(v.buy_price)} → <b className="text-ink-800">{rupiah(v.sell_price)}</b>
                  {mixed && ' · harga varian beda'}
                </p>
              </div>
              <div className="text-right">
                <p className={cx('text-sm font-bold tabular-nums', b.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>{rupiah(b.profit)}</p>
                <p className={cx('text-[11px] font-semibold', (b.marginOnCost ?? 0) < 0.3 ? 'text-sun-600' : 'text-ink-500')}>{pct(b.marginOnCost)} dari modal</p>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <PricingSettings open={settings} onClose={() => setSettings(false)} />
      <ProductPricingSheet product={pick} onClose={() => setPick(null)} />
    </div>
  )
}

function ProductPricingSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const profile = usePricing()
  const toast = useToast()
  const invalidate = useInvalidate()
  const [mode, setMode] = useState<'markup' | 'manual'>('markup')
  const [markup, setMarkup] = useState<number | null>(null)
  const [manual, setManual] = useState(0)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  if (product && product.id !== last) {
    setLast(product.id)
    const v = product.variants[0]
    setMode(v.price_mode === 'markup' ? 'markup' : 'manual')
    setMarkup(v.markup_pct != null ? Number(v.markup_pct) : null)
    setManual(v.sell_price)
  }
  if (!product) return null
  const cfg = pricingCfg(profile, product)
  const v = product.variants[0]
  const target = mode === 'markup' ? (markup != null ? priceFromMarkup(v.buy_price, markup, cfg) : v.sell_price) : manual

  return (
    <Sheet
      open={!!product}
      onClose={() => (onClose(), setLast(null))}
      title={product.name}
      footer={
        <Button
          block
          loading={busy}
          disabled={mode === 'markup' && markup == null}
          onClick={async () => {
            setBusy(true)
            try {
              // tiap varian dihitung dari modalnya masing-masing
              for (const x of product.variants) {
                const sell = mode === 'markup' ? priceFromMarkup(x.buy_price, markup!, cfg) : manual
                const { error } = await supabase
                  .from('variants')
                  .update({ sell_price: sell, price_mode: mode, markup_pct: mode === 'markup' ? markup : null })
                  .eq('id', x.id)
                if (error) throw error
              }
              await invalidate(qk.catalog)
              toast(`Harga jual ${product.variants.length} varian diperbarui`)
              onClose()
              setLast(null)
            } catch (e) {
              toast(errMsg(e), 'error')
            } finally {
              setBusy(false)
            }
          }}
        >
          Terapkan {rupiah(target)} ke {product.variants.length} varian
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-500">
        Modal {rupiah(v.buy_price)} · harga sekarang {rupiah(v.sell_price)}
      </p>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'markup', label: 'Pilih persen' },
          { value: 'manual', label: 'Tulis manual' },
        ]}
      />
      <div className="mt-3">
        {mode === 'markup' ? (
          <SimTable cost={v.buy_price} cfg={cfg} selected={markup} onPick={setMarkup} />
        ) : (
          <MoneyInput value={manual} onChange={setManual} />
        )}
      </div>
      {target > 0 && (
        <div className="mt-3">
          <PriceBreakdown cost={v.buy_price} sell={target} cfg={cfg} />
        </div>
      )}
    </Sheet>
  )
}
