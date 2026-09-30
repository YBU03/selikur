'use client'
import { useState } from 'react'
import { Zap, Ticket, Tag, ChevronDown, ShieldCheck, AlertTriangle, Ban, Info } from 'lucide-react'
import { analyzePromo, promoBreakdown, PROMO_INFO, type PricingCfg, type PromoType, type Recommendation } from '@/lib/pricing'
import { pct, rupiah } from '@/lib/format'
import type { Product } from '@/lib/types'
import { Badge, Button, Card, Chip, Segmented, Thumb, cx } from './ui'

export interface PromoRow {
  no: number
  p: Product
  cost: number
  current: number
  cfg: PricingCfg
  rec: Recommendation
}

const ICON: Record<PromoType, React.ComponentType<{ className?: string }>> = { flash: Zap, voucher: Ticket, diskon: Tag }

function tone(marginPct: number | null, min: number) {
  if (marginPct == null || marginPct <= 0) return 'text-red-600'
  if (marginPct * 100 < min) return 'text-sun-700'
  return 'text-leaf-600'
}

export default function PromoSim({
  rows,
  steps,
  minMargin,
  extraFee,
  view,
  pageSize,
}: {
  rows: PromoRow[]
  steps: number[]
  minMargin: number
  extraFee: number
  view: 'kartu' | 'tabel'
  pageSize: number
}) {
  const [type, setType] = useState<PromoType>('flash')
  const [base, setBase] = useState<'current' | 'saran'>('current')
  const [limit, setLimit] = useState(pageSize)
  const info = PROMO_INFO[type]
  const Icon = ICON[type]

  const data = rows
    .map((r) => {
      const price = base === 'saran' ? r.rec.price : r.current
      return { ...r, price, a: analyzePromo(r.cost, price, r.cfg, type, minMargin, extraFee) }
    })
    .filter((r) => r.price > 0 && r.cost > 0)
  const ok = data.filter((r) => r.a.ok).length

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(Object.keys(PROMO_INFO) as PromoType[]).map((t) => {
          const I = ICON[t]
          return (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              <span className="inline-flex items-center gap-1.5">
                <I className="size-3.5" /> {PROMO_INFO[t].label}
              </span>
            </Chip>
          )
        })}
      </div>

      <Card className="mt-3 bg-gradient-to-br from-sun-50 to-white ring-sun-100">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sun-500 text-white shadow-sun">
            <Icon className="size-5" />
          </span>
          <div className="text-sm">
            <p className="font-bold text-ink-900">
              {info.label}: umumnya {info.range[0]}–{info.range[1]}%
            </p>
            <p className="mt-0.5 text-ink-600">{info.why}</p>
            <p className="mt-1.5 text-ink-600">
              Batas yang dipakai: laba saat promo minimal <b>{minMargin}% dari modal</b>
              {extraFee ? `, biaya program promo ${extraFee}%` : ''}. Potongan platform dihitung dari harga setelah diskon.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Segmented
          className="min-w-[16rem] flex-1"
          value={base}
          onChange={(v) => (setBase(v), setLimit(pageSize))}
          options={[
            { value: 'current', label: 'Dari harga sekarang' },
            { value: 'saran', label: 'Dari harga saran' },
          ]}
        />
        <p className="text-sm text-ink-600">
          <b className="text-leaf-600">{ok}</b> dari {data.length} produk aman ikut {info.label}
        </p>
      </div>

      <div className="mt-4">
        {view === 'kartu' ? (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {data.slice(0, limit).map((r) => (
                <PromoCard key={r.p.id} r={r} steps={steps} minMargin={minMargin} extraFee={extraFee} typeLabel={info.label} />
              ))}
            </div>
            {data.length > limit && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setLimit(limit + pageSize)}>
                  <ChevronDown className="size-4" /> {Math.min(pageSize, data.length - limit)} produk lagi
                </Button>
                <Button variant="soft" onClick={() => setLimit(data.length)}>
                  Tampilkan semua ({data.length})
                </Button>
              </div>
            )}
          </>
        ) : (
          <PromoMatrix data={data} steps={steps} minMargin={minMargin} extraFee={extraFee} />
        )}
      </div>
    </div>
  )
}

type Item = PromoRow & { price: number; a: ReturnType<typeof analyzePromo> }

function Verdict({ a }: { a: Item['a'] }) {
  if (a.breakEven <= 0)
    return (
      <Badge tone="red">
        <Ban className="size-3" /> Jangan ikut
      </Badge>
    )
  if (!a.ok)
    return (
      <Badge tone="orange">
        <AlertTriangle className="size-3" /> Margin tipis
      </Badge>
    )
  return (
    <Badge tone="green">
      <ShieldCheck className="size-3" /> Bisa ikut
    </Badge>
  )
}

function PromoCard({ r, steps, minMargin, extraFee, typeLabel }: { r: Item; steps: number[]; minMargin: number; extraFee: number; typeLabel: string }) {
  const sug = r.a.suggested ? promoBreakdown(r.cost, r.price, r.a.suggested, r.cfg, extraFee) : null
  const aff = r.cfg.affiliatePct > 0
  return (
    <Card className="p-0">
      <div className="flex items-start gap-3 p-4 pb-3">
        <Thumb path={r.p.photos[0]} size={48} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 leading-snug font-semibold">
            <span className="text-ink-400">{r.no}.</span> {r.p.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Verdict a={r.a} />
            <span className="text-xs text-ink-500">
              harga {rupiah(r.price)} · modal {rupiah(r.cost)}
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto px-3">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 uppercase">
              <th className="px-1.5 py-1.5 font-semibold">Diskon</th>
              <th className="px-1.5 py-1.5 text-right font-semibold">Harga promo</th>
              <th className="px-1.5 py-1.5 text-right font-semibold">{aff ? 'Laba organik' : 'Laba/pcs'}</th>
              <th className={cx("px-1.5 py-1.5 text-right font-semibold", aff && "hidden sm:table-cell")}>Margin</th>
              {aff && <th className="px-1.5 py-1.5 text-right font-semibold text-sun-700">Via affiliate</th>}
            </tr>
          </thead>
          <tbody>
            {steps.map((d) => {
              const b = promoBreakdown(r.cost, r.price, d, r.cfg, extraFee)
              const isSug = r.a.suggested === d
              return (
                <tr key={d} className={cx('border-t border-ink-100', isSug && 'bg-leaf-500/10')}>
                  <td className="px-1.5 py-2 font-semibold whitespace-nowrap">
                    {d}%{isSug && <span className="ml-1 rounded bg-leaf-500 px-1 text-[9px] font-bold text-white uppercase">saran</span>}
                  </td>
                  <td className="px-1.5 py-2 text-right font-bold whitespace-nowrap tabular-nums">{rupiah(b.sell)}</td>
                  <td className={cx('px-1.5 py-2 text-right font-semibold whitespace-nowrap tabular-nums', tone(b.marginOnCost, minMargin))}>{rupiah(b.profit)}</td>
                  <td className={cx('px-1.5 py-2 text-right whitespace-nowrap tabular-nums', aff && 'hidden sm:table-cell', tone(b.marginOnCost, minMargin))}>{pct(b.marginOnCost)}</td>
                  {aff && (
                    <td className={cx('px-1.5 py-2 text-right whitespace-nowrap tabular-nums', tone(b.marginAffiliate, minMargin))}>
                      <b>{rupiah(b.profitAffiliate)}</b> <span className="text-[10px] opacity-75">{pct(b.marginAffiliate)}</span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={cx('m-3 rounded-2xl p-3.5 ring-1', r.a.ok ? 'bg-leaf-500/10 ring-leaf-500/20' : 'bg-sun-50 ring-sun-100')}>
        <p className={cx('text-xs font-semibold uppercase', r.a.ok ? 'text-leaf-600' : 'text-sun-700')}>Saran {typeLabel}</p>
        {r.a.suggested > 0 && sug ? (
          <p className="mt-0.5 text-xl font-extrabold text-brand-900">
            Diskon {r.a.suggested}% <span className="text-base font-bold text-ink-600">→ {rupiah(sug.sell)}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-xl font-extrabold text-red-600">Tidak disarankan</p>
        )}
        {sug && (
          <p className="text-xs text-ink-600">
            laba {rupiah(sug.profit)}/pcs · margin {pct(sug.marginOnCost)}
          </p>
        )}
        {sug && aff && (
          <p className={cx('text-xs', sug.profitAffiliate > 0 ? 'text-sun-700' : 'text-red-600')}>
            via affiliate: laba {rupiah(sug.profitAffiliate)} · margin {pct(sug.marginAffiliate)}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-700">{r.a.reason}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
          <span>
            Maks aman <b className="text-ink-800">{r.a.safe}%</b>
          </span>
          <span>
            Impas di <b className="text-ink-800">{r.a.breakEven}%</b>
          </span>
          {aff && (
            <span className="text-sun-700">
              Affiliate: aman {r.a.safeAffiliate}% · impas {r.a.breakEvenAffiliate}%
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

function PromoMatrix({ data, steps, minMargin, extraFee }: { data: Item[]; steps: number[]; minMargin: number; extraFee: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <table className="min-w-max border-separate border-spacing-0 text-sm lg:w-full">
        <thead>
          <tr className="text-[11px] text-ink-500 uppercase">
            <th className="sticky left-0 z-10 rounded-tl-2xl bg-ink-100 px-3 py-2 text-left font-semibold">No · Produk</th>
            <th className="bg-ink-100 px-3 py-2 text-right font-semibold">Harga</th>
            {steps.map((d) => (
              <th key={d} className="bg-ink-100 px-3 py-2 text-right font-semibold">
                −{d}%
              </th>
            ))}
            <th className="bg-leaf-500/15 px-3 py-2 text-right font-semibold text-leaf-600">Saran</th>
            <th className="rounded-tr-2xl bg-ink-100 px-3 py-2 text-right font-semibold">Maks aman</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const bg = i % 2 ? 'bg-ink-50' : 'bg-white'
            return (
              <tr key={r.p.id}>
                <td className={cx('sticky left-0 z-10 max-w-[11rem] border-b border-ink-100 px-3 py-2', bg)}>
                  <p className="truncate font-semibold">
                    <span className="mr-1 text-ink-400">{r.no}.</span>
                    {r.p.name}
                  </p>
                  <Verdict a={r.a} />
                </td>
                <td className={cx('border-b border-ink-100 px-3 py-2 text-right font-bold tabular-nums', bg)}>{rupiah(r.price)}</td>
                {steps.map((d) => {
                  const b = promoBreakdown(r.cost, r.price, d, r.cfg, extraFee)
                  return (
                    <td key={d} className={cx('border-b border-ink-100 px-3 py-2 text-right tabular-nums', r.a.suggested === d ? 'bg-leaf-500/15' : bg)}>
                      <b>{rupiah(b.sell)}</b>
                      <p className={cx('text-[11px] font-semibold', tone(b.marginOnCost, minMargin))}>{rupiah(b.profit)}</p>
                      {r.cfg.affiliatePct > 0 && <p className={cx('text-[11px]', b.profitAffiliate > 0 ? 'text-sun-700' : 'text-red-600')}>af {rupiah(b.profitAffiliate)}</p>}
                    </td>
                  )
                })}
                <td className="border-b border-ink-100 bg-leaf-500/10 px-3 py-2 text-right font-bold text-brand-900">{r.a.suggested ? `${r.a.suggested}%` : '–'}</td>
                <td className={cx('border-b border-ink-100 px-3 py-2 text-right tabular-nums', bg)}>
                  {r.a.safe}%{r.cfg.affiliatePct > 0 && <p className="text-[11px] text-sun-700">af {r.a.safeAffiliate}%</p>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
        <Info className="mt-0.5 size-3.5 shrink-0" /> Angka kecil = laba bersih/pcs organik; &quot;af&quot; = laba bila lewat affiliate. Hijau = aman (≥ {minMargin}% modal), oranye = tipis, merah = rugi.
      </p>
    </div>
  )
}
