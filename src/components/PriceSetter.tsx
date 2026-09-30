'use client'
import { Percent, PenLine } from 'lucide-react'
import { breakdown, impliedMarkup, MARKUP_PRESETS, priceFromMarkup, type PricingCfg } from '@/lib/pricing'
import { num, pct, rupiah } from '@/lib/format'
import { Chip, MoneyInput, Segmented, cx } from './ui'

export interface PriceValue {
  sell_price: number
  price_mode: 'manual' | 'markup'
  markup_pct: number | null
}

export function PriceBreakdown({ cost, sell, cfg, compact }: { cost: number; sell: number; cfg: PricingCfg; compact?: boolean }) {
  const b = breakdown(cost, sell, cfg)
  const good = b.profit > 0
  const Row = ({ label, value, tone, strong }: { label: React.ReactNode; value: string; tone?: string; strong?: boolean }) => (
    <div className={cx('flex items-center justify-between', strong ? 'py-1 text-[15px] font-bold' : 'text-sm')}>
      <span className={strong ? 'text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={cx('tabular-nums', tone ?? (strong ? 'text-ink-900' : 'text-ink-700'))}>{value}</span>
    </div>
  )
  return (
    <div className="space-y-1.5 rounded-2xl bg-ink-50 p-3.5 ring-1 ring-ink-100">
      <Row label="Harga jual" value={rupiah(b.sell)} />
      <Row label={`Potongan platform ${num(cfg.feePct, 1)}%`} value={`− ${rupiah(b.fee)}`} tone="text-red-600" />
      {cfg.affiliatePct > 0 && <Row label={`Komisi affiliate ${num(cfg.affiliatePct, 1)}%`} value={`− ${rupiah(b.affiliate)}`} tone="text-red-600" />}
      {!compact && <Row label="Uang diterima" value={rupiah(b.net)} />}
      <Row label="Modal (harga kulakan)" value={`− ${rupiah(b.cost)}`} />
      <div className="my-1 h-px bg-ink-200" />
      <Row label="Laba bersih / pcs" value={rupiah(b.profit)} tone={good ? 'text-leaf-600' : 'text-red-600'} strong />
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-xs text-ink-500">
        <span>
          Margin dari modal <b className={good ? 'text-leaf-600' : 'text-red-600'}>{pct(b.marginOnCost, 1)}</b>
        </span>
        <span>
          dari harga jual <b className="text-ink-700">{pct(b.marginOnSell, 1)}</b>
        </span>
        {cfg.affiliatePct > 0 && (
          <span>
            tanpa affiliate <b className="text-ink-700">{rupiah(b.profitNoAffiliate)}</b>
          </span>
        )}
      </div>
    </div>
  )
}

export default function PriceSetter({ cost, value, onChange, cfg }: { cost: number; value: PriceValue; onChange: (v: PriceValue) => void; cfg: PricingCfg }) {
  const markup = value.markup_pct ?? 50
  const implied = impliedMarkup(cost, value.sell_price, cfg)
  return (
    <div className="space-y-3">
      <Segmented
        value={value.price_mode}
        onChange={(m) =>
          onChange(
            m === 'markup'
              ? { price_mode: 'markup', markup_pct: markup, sell_price: priceFromMarkup(cost, markup, cfg) }
              : { ...value, price_mode: 'manual' },
          )
        }
        options={[
          {
            value: 'markup',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Percent className="size-4" /> Pakai persen
              </span>
            ),
          },
          {
            value: 'manual',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <PenLine className="size-4" /> Tulis manual
              </span>
            ),
          },
        ]}
      />

      {value.price_mode === 'markup' ? (
        <div className="space-y-3">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {MARKUP_PRESETS.map((m) => (
              <Chip key={m} active={markup === m} onClick={() => onChange({ price_mode: 'markup', markup_pct: m, sell_price: priceFromMarkup(cost, m, cfg) })}>
                {m}%
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
            <label className="relative block">
              <input
                inputMode="decimal"
                value={value.markup_pct ?? ''}
                onChange={(e) => {
                  const m = Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0
                  onChange({ price_mode: 'markup', markup_pct: m, sell_price: priceFromMarkup(cost, m, cfg) })
                }}
                className="h-12 w-full rounded-2xl border border-ink-200 bg-white pr-9 pl-4 text-right font-semibold tabular-nums outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-400">%</span>
            </label>
            <div className="rounded-2xl bg-brand-50 px-4 py-2 text-right">
              <p className="text-[11px] font-medium text-brand-700">Harga jual disarankan</p>
              <p className="text-lg font-extrabold text-brand-800 tabular-nums">{rupiah(value.sell_price)}</p>
            </div>
          </div>
          <p className="text-xs text-ink-500">
            Untung {markup}% dari modal ({rupiah((cost * markup) / 100)}),{' '}
            {cfg.basis === 'price' ? 'harga sudah dinaikkan agar tetap untung setelah dipotong platform' : 'potongan ditambahkan seperti rumus Excel'}
            {cfg.affiliatePct > 0 ? ' & komisi affiliate' : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <MoneyInput value={value.sell_price} onChange={(n) => onChange({ price_mode: 'manual', markup_pct: null, sell_price: n })} />
          {implied != null && value.sell_price > 0 && (
            <p className="px-1 text-xs text-ink-500">
              Setara markup <b className="text-ink-700">{num(implied, 1)}%</b> dari modal
            </p>
          )}
        </div>
      )}

      {cost > 0 && value.sell_price > 0 && <PriceBreakdown cost={cost} sell={value.sell_price} cfg={cfg} />}
    </div>
  )
}
