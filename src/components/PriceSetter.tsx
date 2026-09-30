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

/** Rincian harga: kolom penjualan organik dan (bila ada komisi) kolom lewat affiliate. */
export function PriceBreakdown({ cost, sell, cfg }: { cost: number; sell: number; cfg: PricingCfg; compact?: boolean }) {
  const b = breakdown(cost, sell, cfg)
  const aff = cfg.affiliatePct > 0
  const tone = (n: number) => (n > 0 ? 'text-leaf-600' : 'text-red-600')
  const Row = ({ label, org, affv, toneOrg, toneAff, strong }: { label: React.ReactNode; org: string; affv?: string; toneOrg?: string; toneAff?: string; strong?: boolean }) => (
    <tr className={cx(strong && 'border-t border-ink-200 text-[15px] font-bold')}>
      <td className={cx('py-1 pr-2', strong ? 'pt-2 text-ink-900' : 'text-ink-500')}>{label}</td>
      <td className={cx('py-1 text-right tabular-nums', strong && 'pt-2', toneOrg ?? (strong ? 'text-ink-900' : 'text-ink-700'))}>{org}</td>
      {aff && <td className={cx('py-1 pl-3 text-right tabular-nums', strong && 'pt-2', toneAff ?? (strong ? 'text-ink-900' : 'text-ink-700'))}>{affv ?? org}</td>}
    </tr>
  )
  return (
    <div className="rounded-2xl bg-ink-50 p-3.5 ring-1 ring-ink-100">
      <table className="w-full text-sm">
        {aff && (
          <thead>
            <tr className="text-[11px] text-ink-500 uppercase">
              <th />
              <th className="pb-1 text-right font-semibold">Organik</th>
              <th className="pb-1 pl-3 text-right font-semibold text-sun-700">Via affiliate</th>
            </tr>
          </thead>
        )}
        <tbody>
          <Row label="Harga jual" org={rupiah(b.sell)} />
          <Row label={`Potongan platform ${num(cfg.feePct, 1)}%`} org={`− ${rupiah(b.fee)}`} toneOrg="text-red-600" toneAff="text-red-600" />
          {aff && <Row label={`Komisi affiliate ${num(cfg.affiliatePct, 1)}%`} org="–" affv={`− ${rupiah(b.commission)}`} toneOrg="text-ink-300" toneAff="text-red-600" />}
          <Row label="Uang diterima" org={rupiah(b.sell - b.fee)} affv={rupiah(b.sell - b.fee - b.commission)} />
          <Row label="Modal" org={`− ${rupiah(b.cost)}`} />
          <Row label="Laba bersih / pcs" org={rupiah(b.profitOrganic)} affv={rupiah(b.profitAffiliate)} toneOrg={tone(b.profitOrganic)} toneAff={tone(b.profitAffiliate)} strong />
          <Row label="Margin dari modal" org={pct(b.marginOnCost, 1)} affv={pct(b.marginAffiliate, 1)} toneOrg={tone(b.profitOrganic)} toneAff={tone(b.profitAffiliate)} />
          <Row label="Margin dari harga jual" org={pct(b.marginOnSell, 1)} affv={pct(sell ? b.profitAffiliate / sell : null, 1)} />
        </tbody>
      </table>
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
            {cfg.affiliateInPrice && cfg.affiliatePct > 0 ? ' & komisi affiliate' : ''}.
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
