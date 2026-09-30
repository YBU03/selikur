'use client'
import { AdminOnly } from '@/components/AppShell'
import { memo, useMemo, useState, useDeferredValue } from 'react'
import { Calculator, Settings2, Search, Check, LayoutList, Table2, Sparkles, FileSpreadsheet, ChevronDown, Wand2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCatalog, usePricing, useInvalidate, useSalesBuckets, qk } from '@/lib/queries'
import {
  breakdown,
  impliedMarkup,
  MARKUP_PRESETS,
  priceFromMarkup,
  pricingCfg,
  recommend,
  velocityOf,
  PRICE_STATUS_INFO,
  simCfg,
  type SimCfg,
  VELOCITY_INFO,
  type PriceStatus,
  type PricingCfg,
  type Recommendation,
} from '@/lib/pricing'
import { movingAverage } from '@/lib/forecast'
import { num, pct, rupiah } from '@/lib/format'
import type { Product, Variant } from '@/lib/types'
import { Badge, Button, Card, Chip, Confirm, Input, MoneyInput, PageHeader, SectionTitle, Segmented, Sheet, Thumb, cx, Loading, EmptyState } from '@/components/ui'
import { PriceBreakdown } from '@/components/PriceSetter'
import PricingSettings from '@/components/PricingSettings'
import PromoSim from '@/components/PromoSim'
import { PercentInput } from '@/components/ProductEditor'
import { useToast, errMsg } from '@/components/Toast'

interface Row {
  p: Product
  v: Variant
  cost: number
  current: number
  cfg: PricingCfg
  weekly: number
  rec: Recommendation
  mixed: boolean
  sim: SimCfg
  no: number
}

const PAGE = 3

/** Markup simulasi yang paling dekat dengan harga sekarang (untuk menandai baris). */
function nearestStep(cost: number, current: number, cfg: PricingCfg, steps: number[]) {
  if (!current) return null
  let best: number | null = null
  let diff = Infinity
  for (const m of steps) {
    const d = Math.abs(priceFromMarkup(cost, m, cfg) - current)
    if (d < diff) {
      diff = d
      best = m
    }
  }
  return best != null && diff / current <= 0.03 ? best : null
}

function StatusBadge({ s }: { s: PriceStatus }) {
  const i = PRICE_STATUS_INFO[s]
  return <Badge tone={i.tone}>{i.label}</Badge>
}

type Channel = 'organik' | 'affiliate'

/**
 * Tabel simulasi: per baris margin → harga jual, potongan platform, komisi affiliate (bila kanal affiliate),
 * dan laba BERSIH yang benar-benar diterima setelah dikurangi modal.
 */
function SimTable({
  cost,
  cfg,
  steps = [50, 60, 70, 80, 90, 100],
  current,
  recMarkup,
  selected,
  onPick,
  channel = 'organik',
}: {
  cost: number
  cfg: PricingCfg
  steps?: number[]
  current?: number
  recMarkup?: number
  selected?: number | null
  onPick?: (m: number) => void
  channel?: Channel
}) {
  const near = current ? nearestStep(cost, current, cfg, steps) : null
  const aff = channel === 'affiliate' && cfg.affiliatePct > 0
  const th = 'px-1 py-1.5 text-right font-semibold sm:px-1.5'
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[12px] sm:text-[13px]">
        <thead>
          <tr className="text-left text-[10px] leading-tight text-ink-500 uppercase sm:text-[11px]">
            <th className="px-1 py-1.5 font-semibold sm:px-1.5">Margin</th>
            <th className={th}>Harga jual</th>
            <th className={cx(th, 'text-red-600')}>Platform {num(cfg.feePct, 1)}%</th>
            {aff && <th className={cx(th, 'text-sun-700')}>Affiliate {num(cfg.affiliatePct, 1)}%</th>}
            <th className={cx(th, 'text-leaf-600')}>Bersih</th>
          </tr>
        </thead>
        <tbody>
          {current != null && current > 0 && near == null && <CurrentRow cost={cost} current={current} cfg={cfg} channel={channel} />}
          {steps.map((m) => {
            const sell = priceFromMarkup(cost, m, cfg)
            const b = breakdown(cost, sell, cfg, aff ? 'affiliate' : 'organik')
            const on = selected === m
            const isRec = recMarkup != null && Math.abs(recMarkup - m) < 5
            return (
              <tr
                key={m}
                onClick={() => onPick?.(m)}
                className={cx('border-t border-ink-100', onPick && 'cursor-pointer active:bg-ink-50', on ? 'bg-brand-50' : isRec ? 'bg-leaf-500/5' : '')}
              >
                <td className="px-1 py-2 font-semibold sm:px-1.5">
                  <span className="flex max-w-[4rem] flex-wrap items-center gap-1 sm:max-w-none sm:flex-nowrap sm:whitespace-nowrap">
                    {on && <Check className="size-3.5 text-brand-700" />}
                    {m}%
                    {near === m && <span className="rounded bg-ink-800 px-1 text-[9px] font-bold text-white uppercase">sekarang</span>}
                    {isRec && <span className="rounded bg-leaf-500 px-1 text-[9px] font-bold text-white uppercase">saran</span>}
                  </span>
                </td>
                <td className="px-1 py-2 text-right font-bold whitespace-nowrap tabular-nums sm:px-1.5">{rupiah(sell)}</td>
                <td className="px-1 py-2 text-right whitespace-nowrap text-red-600 tabular-nums sm:px-1.5">−{rupiah(b.fee).replace('Rp ', '')}</td>
                {aff && <td className="px-1 py-2 text-right whitespace-nowrap text-sun-700 tabular-nums sm:px-1.5">−{rupiah(b.affiliate).replace('Rp ', '')}</td>}
                <td className={cx('px-1 py-2 text-right whitespace-nowrap tabular-nums sm:px-1.5', b.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>
                  <b>{rupiah(b.profit)}</b>
                  <span className="block text-[10px] opacity-75">{pct(b.marginOnCost)} modal</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1.5 px-1 text-[11px] text-ink-500">
        Bersih = harga jual − potongan platform{aff ? ' − komisi affiliate' : ''} − modal {rupiah(cost)}. Potongan & komisi dihitung dari harga jual.
      </p>
    </div>
  )
}

function CurrentRow({ cost, current, cfg, channel }: { cost: number; current: number; cfg: PricingCfg; channel: Channel }) {
  const aff = channel === 'affiliate' && cfg.affiliatePct > 0
  const b = breakdown(cost, current, cfg, aff ? 'affiliate' : 'organik')
  const im = impliedMarkup(cost, current, cfg)
  return (
    <tr className="border-t border-ink-100 bg-ink-800 text-white">
      <td className="rounded-l-xl px-1 py-2 font-semibold whitespace-nowrap sm:px-1.5">
        Sekarang <span className="block text-[10px] font-normal text-white/70 sm:inline">{im != null ? `${num(Math.max(im, -99), 0)}%` : ''}</span>
      </td>
      <td className="px-1 py-2 text-right font-bold whitespace-nowrap tabular-nums sm:px-1.5">{rupiah(current)}</td>
      <td className="px-1 py-2 text-right whitespace-nowrap text-red-300 tabular-nums sm:px-1.5">−{rupiah(b.fee).replace('Rp ', '')}</td>
      {aff && <td className="px-1 py-2 text-right whitespace-nowrap text-sun-300 tabular-nums sm:px-1.5">−{rupiah(b.affiliate).replace('Rp ', '')}</td>}
      <td className={cx('rounded-r-xl px-1 py-2 text-right whitespace-nowrap tabular-nums sm:px-1.5', b.profit > 0 ? 'text-leaf-400' : 'text-red-300')}>
        <b>{rupiah(b.profit)}</b>
        <span className="block text-[10px] opacity-75">{pct(b.marginOnCost)} modal</span>
      </td>
    </tr>
  )
}

/** Rincian satu harga: harga − platform − affiliate − modal = bersih. */
function Rincian({ cost, sell, cfg, channel, dark }: { cost: number; sell: number; cfg: PricingCfg; channel: Channel; dark?: boolean }) {
  const aff = channel === 'affiliate' && cfg.affiliatePct > 0
  const b = breakdown(cost, sell, cfg, aff ? 'affiliate' : 'organik')
  return (
    <div className={cx('space-y-0.5 text-[11px] tabular-nums', dark ? 'text-ink-600' : 'text-ink-500')}>
      <p className="flex justify-between gap-2">
        <span>Platform {num(cfg.feePct, 1)}%</span>
        <span className="whitespace-nowrap text-red-600">−{rupiah(b.fee)}</span>
      </p>
      {aff && (
        <p className="flex justify-between gap-2">
          <span>Affiliate {num(cfg.affiliatePct, 1)}%</span>
          <span className="whitespace-nowrap text-sun-700">−{rupiah(b.affiliate)}</span>
        </p>
      )}
      <p className="flex justify-between gap-2">
        <span>Modal</span>
        <span className="whitespace-nowrap">−{rupiah(cost)}</span>
      </p>
      <p className={cx('flex justify-between gap-2 border-t border-ink-200 pt-0.5 text-[12px] font-bold', b.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>
        <span>Bersih</span>
        <span className="whitespace-nowrap">
          {rupiah(b.profit)} · {pct(b.marginOnCost)}
        </span>
      </p>
    </div>
  )
}

function Diff({ from, to }: { from: number; to: number }) {
  if (!from) return null
  const d = (to - from) / from
  if (Math.abs(d) < 0.005) return <span className="inline-flex items-center gap-0.5 text-xs text-ink-500"><Minus className="size-3" /> sama</span>
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-semibold', d > 0 ? 'text-leaf-600' : 'text-sun-700')}>
      {d > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {d > 0 ? '+' : ''}
      {pct(d)}
    </span>
  )
}

type SimCardProps = { r: Row; onApply: () => void; onOpen: () => void; channel: Channel }

/** Di-memo: callback hanya menutup `r`, jadi cukup bandingkan `r` & `channel`. */
const ProductSimCard = memo(ProductSimCardInner, (a, b) => a.r === b.r && a.channel === b.channel)

function ProductSimCardInner({ r, onApply, onOpen, channel }: SimCardProps) {
  const aff = channel === 'affiliate' && r.cfg.affiliatePct > 0
  const sar = breakdown(r.cost, r.rec.price, r.cfg, aff ? 'affiliate' : 'organik')
  return (
    <Card className="p-0">
      <div className="flex items-start gap-3 p-4 pb-3">
        <Thumb path={r.p.photos[0]} size={52} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 leading-snug font-semibold">
            <span className="text-ink-400">{r.no}.</span> {r.p.name}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {r.current > 0 && <StatusBadge s={r.rec.status} />}
            <Badge tone="gray">{VELOCITY_INFO[r.rec.velocity].label}{r.weekly > 0 ? ` · ${num(r.weekly, 1)}/mg` : ''}</Badge>
            {r.mixed && <Badge tone="gray">harga varian beda</Badge>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-y border-ink-100 bg-ink-100">
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-[11px] text-ink-500">Modal / pcs</p>
          <p className="font-bold tabular-nums">{rupiah(r.cost)}</p>
        </div>
        <div className="bg-white px-3 py-2">
          <p className="text-center text-[11px] text-ink-500">Harga sekarang</p>
          <p className="text-center font-bold tabular-nums">{r.current ? rupiah(r.current) : '–'}</p>
          {r.current > 0 && <Rincian cost={r.cost} sell={r.current} cfg={r.cfg} channel={channel} />}
        </div>
      </div>
      <div className="px-3 pt-2">
        <SimTable cost={r.cost} cfg={r.cfg} steps={r.sim.steps} current={r.current} recMarkup={r.rec.markup} channel={channel} />
      </div>
      <div className="m-3 rounded-2xl bg-gradient-to-br from-leaf-500/10 to-brand-50 p-3.5 ring-1 ring-leaf-500/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-leaf-600 uppercase">
              <Sparkles className="size-3.5" /> Saran harga
            </p>
            <p className="mt-0.5 text-2xl font-extrabold text-brand-900 tabular-nums">{rupiah(r.rec.price)}</p>
            <p className="text-xs text-ink-600">
              bersih {rupiah(sar.profit)}/pcs{aff ? ' (lewat affiliate)' : ''} <Diff from={r.current} to={r.rec.price} />
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/70 p-2 sm:w-48">
            <Rincian cost={r.cost} sell={r.rec.price} cfg={r.cfg} channel={channel} dark />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-600">
          {VELOCITY_INFO[r.rec.velocity].reason} <b className="text-ink-800">{r.rec.message}</b>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" variant="soft" onClick={onOpen}>
            Pilih sendiri
          </Button>
          <Button size="sm" disabled={r.rec.price === r.current} onClick={onApply}>
            <Check className="size-4" /> Pakai saran
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Matrix({ rows, onOpen, steps, channel }: { rows: Row[]; onOpen: (r: Row) => void; steps: number[]; channel: Channel }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <table className="min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-[11px] text-ink-500 uppercase">
            <th className="sticky left-0 z-10 rounded-tl-2xl bg-ink-100 px-3 py-2 text-left font-semibold">No · Produk</th>
            <th className="bg-ink-100 px-3 py-2 text-right font-semibold">Modal</th>
            <th className="bg-ink-100 px-3 py-2 text-right font-semibold">Sekarang</th>
            {steps.map((m) => (
              <th key={m} className="bg-ink-100 px-3 py-2 text-right font-semibold">
                {m}%
              </th>
            ))}
            <th className="rounded-tr-2xl bg-leaf-500/15 px-3 py-2 text-right font-semibold text-leaf-600">Saran</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const aff = channel === 'affiliate' && r.cfg.affiliatePct > 0
            const ch = aff ? 'affiliate' : 'organik'
            const near = nearestStep(r.cost, r.current, r.cfg, steps)
            const now = breakdown(r.cost, r.current, r.cfg, ch)
            const sar = breakdown(r.cost, r.rec.price, r.cfg, ch)
            const bg = i % 2 ? 'bg-ink-50' : 'bg-white'
            const Cut = ({ b, dark }: { b: ReturnType<typeof breakdown>; dark?: boolean }) => (
              <p className={cx('text-[10px]', dark ? 'text-white/70' : 'text-ink-400')}>
                −{rupiah(b.fee + b.affiliate).replace('Rp ', '')} potongan
              </p>
            )
            return (
              <tr key={r.p.id} onClick={() => onOpen(r)} className="cursor-pointer">
                <td className={cx('sticky left-0 z-10 max-w-[10rem] border-b border-ink-100 px-3 py-2', bg)}>
                  <p className="truncate font-semibold">
                    <span className="mr-1 text-ink-400">{r.no}.</span>
                    {r.p.name}
                  </p>
                  <div className="mt-0.5 flex gap-1">{r.current > 0 && <StatusBadge s={r.rec.status} />}</div>
                </td>
                <td className={cx('border-b border-ink-100 px-3 py-2 text-right tabular-nums', bg)}>{rupiah(r.cost)}</td>
                <td className={cx('border-b border-ink-100 px-3 py-2 text-right tabular-nums', bg)}>
                  <b>{r.current ? rupiah(r.current) : '–'}</b>
                  {r.current > 0 && (
                    <>
                      <Cut b={now} />
                      <p className={cx('text-[11px] font-semibold', now.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>bersih {rupiah(now.profit)}</p>
                    </>
                  )}
                </td>
                {steps.map((m) => {
                  const s = priceFromMarkup(r.cost, m, r.cfg)
                  const b = breakdown(r.cost, s, r.cfg, ch)
                  const dark = near === m
                  return (
                    <td key={m} className={cx('border-b border-ink-100 px-3 py-2 text-right tabular-nums', dark ? 'bg-ink-800 text-white' : bg)}>
                      <b>{rupiah(s)}</b>
                      <Cut b={b} dark={dark} />
                      <p className={cx('text-[11px] font-semibold', dark ? 'text-leaf-400' : b.profit > 0 ? 'text-leaf-600' : 'text-red-600')}>bersih {rupiah(b.profit)}</p>
                    </td>
                  )
                })}
                <td className="border-b border-ink-100 bg-leaf-500/10 px-3 py-2 text-right tabular-nums">
                  <b className="text-brand-900">{rupiah(r.rec.price)}</b>
                  <Cut b={sar} />
                  <p className="text-[11px] font-semibold text-leaf-600">bersih {rupiah(sar.profit)}</p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-500">
        Tiap sel: harga jual, total potongan (platform{channel === 'affiliate' ? ' + komisi affiliate' : ''}), dan laba bersih per pcs setelah dikurangi modal. Kotak gelap = posisi harga sekarang.
      </p>
    </div>
  )
}

async function exportSimulation(rows: Row[], steps: number[]) {
  const ExcelJS = (await import('exceljs')).default
  const { deliver } = await import('@/lib/exporters')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Simulasi Harga')
  ws.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Produk', key: 'name', width: 38 },
    { header: 'Modal', key: 'cost', width: 12 },
    { header: 'Harga Sekarang', key: 'cur', width: 15 },
    { header: 'Laba Sekarang', key: 'curp', width: 14 },
    { header: 'Laba Sekarang via Affiliate', key: 'curpa', width: 16 },
    ...steps.flatMap((m) => [
      { header: `Harga ${m}%`, key: `h${m}`, width: 13 },
      { header: `Laba ${m}%`, key: `l${m}`, width: 12 },
      { header: `Laba ${m}% Affiliate`, key: `a${m}`, width: 14 },
    ]),
    { header: 'Saran', key: 'rec', width: 13 },
    { header: 'Laba Saran', key: 'recp', width: 12 },
    { header: 'Laba Saran Affiliate', key: 'recpa', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Kecepatan Jual', key: 'vel', width: 15 },
  ]
  for (const r of rows) {
    const now = breakdown(r.cost, r.current, r.cfg)
    const sar = breakdown(r.cost, r.rec.price, r.cfg)
    const row: Record<string, string | number> = {
      no: r.no,
      name: r.p.name,
      cost: r.cost,
      cur: r.current,
      curp: now.profitOrganic,
      curpa: now.profitAffiliate,
      rec: r.rec.price,
      recp: sar.profitOrganic,
      recpa: sar.profitAffiliate,
      status: PRICE_STATUS_INFO[r.rec.status].label,
      vel: VELOCITY_INFO[r.rec.velocity].label,
    }
    for (const m of steps) {
      const s = priceFromMarkup(r.cost, m, r.cfg)
      row[`h${m}`] = s
      const b = breakdown(r.cost, s, r.cfg)
      row[`l${m}`] = b.profitOrganic
      row[`a${m}`] = b.profitAffiliate
    }
    ws.addRow(row)
  }
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5F49' } }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
  ws.columns.forEach((c, i) => {
    if (i > 1 && i < ws.columns.length - 2) c.numFmt = '"Rp" #,##0'
  })
  const buf = await wb.xlsx.writeBuffer()
  await deliver(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Selikur-Simulasi-Harga.xlsx')
}

function HargaPageInner() {
  const profile = usePricing()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: products, isPending } = useCatalog()
  const { data: buckets } = useSalesBuckets()
  const [view, setView] = useState<'kartu' | 'tabel'>('kartu')
  const [filterUi, setFilter] = useState<PriceStatus | 'all' | 'ubah'>('all')
  const filter = useDeferredValue(filterUi)
  const [qInput, setQ] = useState('')
  const q = useDeferredValue(qInput)
  const [limit, setLimit] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 6 : PAGE))
  const [settings, setSettings] = useState(false)
  const [calc, setCalc] = useState(false)
  const [pick, setPick] = useState<Product | null>(null)
  const [confirm, setConfirm] = useState<Row[] | null>(null)
  const [cost, setCost] = useState(50000)
  const [sell, setSell] = useState(0)
  const cfg = pricingCfg(profile)
  const sim = simCfg(profile)
  const [tab, setTab] = useState<'harga' | 'promo'>('harga')
  const [channel, setChannel] = useState<Channel>('organik')
  const [page] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 6 : PAGE))

  const all = useMemo<Row[]>(() => {
    const list = (products ?? [])
      .filter((p) => p.variants.length && p.status !== 'inactive' && !p._pending)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    const weeklyOf = (p: Product) => p.variants.reduce((s, v) => s + movingAverage(buckets?.get(v.id) ?? [], profile.forecast_method), 0)
    const weeklies = list.map(weeklyOf)
    const withData = weeklies.filter((w) => w > 0)
    const avg = withData.length ? withData.reduce((a, b) => a + b, 0) / withData.length : 0
    return list.map((p, i) => {
      const v = p.variants[0]
      const c = pricingCfg(profile, p)
      const vel = velocityOf(weeklies[i], avg, withData.length > 0)
      return {
        p,
        v,
        cost: v.buy_price,
        current: v.sell_price,
        cfg: c,
        weekly: weeklies[i],
        rec: recommend(v.buy_price, v.sell_price, c, vel, sim),
        sim,
        no: i + 1,
        mixed: p.variants.some((x) => x.sell_price !== v.sell_price || x.buy_price !== v.buy_price),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, buckets, profile])

  const counts = useMemo(() => {
    const c = { all: all.length, rugi: 0, murah: 0, aman: 0, premium: 0, ubah: 0 }
    for (const r of all) {
      c[r.rec.status]++
      if (!r.rec.fits) c.ubah++
    }
    return c
  }, [all])

  const rows = all
    .filter((r) => (filter === 'all' ? true : filter === 'ubah' ? !r.rec.fits : r.rec.status === filter))
    .filter((r) => !q || r.p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.no - b.no)

  async function applyRecs(target: Row[]) {
    try {
      for (const r of target) {
        const sameCost = r.p.variants.every((x) => x.buy_price === r.cost)
        for (const x of r.p.variants) {
          const price = sameCost ? r.rec.price : recommend(x.buy_price, x.sell_price, r.cfg, r.rec.velocity, sim).price
          const { error } = await supabase
            .from('variants')
            .update({ sell_price: price, price_mode: 'manual', markup_pct: null })
            .eq('id', x.id)
          if (error) throw error
        }
      }
      await invalidate(qk.catalog)
      toast(`Harga saran dipakai untuk ${target.length} produk`)
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const filterChips: { v: typeof filter; label: string; n: number }[] = [
    { v: 'all', label: 'Semua', n: counts.all },
    { v: 'ubah', label: 'Belum sesuai saran', n: counts.ubah },
    { v: 'rugi', label: 'Rugi', n: counts.rugi },
    { v: 'murah', label: 'Terlalu murah', n: counts.murah },
    { v: 'aman', label: 'Aman', n: counts.aman },
    { v: 'premium', label: 'Premium', n: counts.premium },
  ]
  const toApply = rows.filter((r) => r.rec.price !== r.current)

  return (
    <div>
      <PageHeader
        title="Harga Jual & Simulasi"
        subtitle="Simulasi margin 50–100% dan saran harga per produk"
        back="/menu"
        action={
          <Button size="sm" variant="soft" onClick={() => setSettings(true)}>
            <Settings2 className="size-4" /> Atur
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['Potongan platform', `${num(cfg.feePct, 1)}%`],
          ['Komisi affiliate', `${num(cfg.affiliatePct, 1)}%`],
          ['Hitung potongan', cfg.basis === 'price' ? 'Dari harga' : 'Seperti Excel'],
        ].map(([k, v]) => (
          <button key={k} onClick={() => setSettings(true)} className="rounded-2xl bg-white px-1 py-2.5 text-center shadow-soft ring-1 ring-ink-100">
            <p className="text-base font-bold text-brand-800">{v}</p>
            <p className="text-[11px] text-ink-500">{k}</p>
          </button>
        ))}
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'harga', label: 'Harga Jual' },
          { value: 'promo', label: 'Promo & Diskon' },
        ]}
      />

      {tab === 'harga' && (
        <Card className="bg-brand-50/60 ring-brand-100">
          <p className="text-sm text-ink-700">
            <b>Cara baca saran:</b> margin aman{' '}
            <b>
              {sim.safeMin}–{sim.safeMax}% dari modal
            </b>{' '}
            (setelah potongan platform{cfg.affiliateInPrice && cfg.affiliatePct ? ' & affiliate' : ''}){cfg.affiliatePct > 0 && !cfg.affiliateInPrice ? `. Pilih "Lewat affiliate" untuk melihat bersih setelah komisi ${cfg.affiliatePct}%` : ''}. Produk <b>laris</b> disarankan ±{sim.targets.laris}%, <b>normal</b> ±{sim.targets.normal}%,{' '}
            <b>lambat</b> ±{sim.targets.lambat}%, lalu dibulatkan ke harga cantik (…900).{' '}
            <button onClick={() => setSettings(true)} className="font-semibold text-brand-700 underline">
              Ubah persen
            </button>
          </p>
        </Card>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
          <Input className="pl-11" placeholder="Cari produk" value={qInput} onChange={(e) => (setQ(e.target.value), setLimit(page))} />
        </div>
        <Segmented
          className="w-[7.5rem] shrink-0"
          value={view}
          onChange={setView}
          options={[
            { value: 'kartu', label: <LayoutList className="mx-auto size-4.5" aria-label="Kartu" /> },
            { value: 'tabel', label: <Table2 className="mx-auto size-4.5" aria-label="Tabel" /> },
          ]}
        />
      </div>
      {tab === 'promo' ? (
        <div className="mt-4">
          <PromoSim
            key={`${q}-${view}`}
            rows={all.filter((r) => !q || r.p.name.toLowerCase().includes(q.toLowerCase()))}
            steps={(profile.promo_steps?.length ? profile.promo_steps : [5, 10, 15, 20, 25, 30]).map(Number)}
            minMargin={Number(profile.promo_min_margin_pct ?? 20)}
            extraFee={Number(profile.promo_extra_fee_pct ?? 0)}
            view={view}
            pageSize={page}
          />
        </div>
      ) : (
      <>
      {cfg.affiliatePct > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink-600">Hitung laba bersih:</span>
          <Segmented
            className="min-w-[17rem] flex-1 sm:flex-none"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'organik', label: 'Organik' },
              { value: 'affiliate', label: `Lewat affiliate ${num(cfg.affiliatePct, 1)}%` },
            ]}
          />
        </div>
      )}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {filterChips.map((c) => (
          <Chip key={c.v} active={filterUi === c.v} onClick={() => (setFilter(c.v), setLimit(page))}>
            {c.label} <span className="opacity-60">{c.n}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        {isPending && <Loading />}
        {!isPending && rows.length === 0 && <EmptyState title="Tidak ada produk" text="Ubah filter atau tambah produk dengan harga kulak." />}

        {view === 'kartu' ? (
          <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rows.slice(0, limit).map((r) => (
              <ProductSimCard key={r.p.id} r={r} channel={channel} onOpen={() => setPick(r.p)} onApply={() => setConfirm([r])} />
            ))}
          </div>
            {rows.length > limit && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setLimit(limit + page)}>
                  <ChevronDown className="size-4" /> {Math.min(page, rows.length - limit)} produk lagi
                </Button>
                <Button variant="soft" onClick={() => setLimit(rows.length)}>
                  Tampilkan semua ({rows.length})
                </Button>
              </div>
            )}
          </>
        ) : (
          rows.length > 0 && <Matrix rows={rows} steps={sim.steps} channel={channel} onOpen={(r) => setPick(r.p)} />
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 grid gap-2">
          {toApply.length > 0 && (
            <Button onClick={() => setConfirm(toApply)}>
              <Wand2 className="size-4.5" /> Pakai saran untuk {toApply.length} produk{filter !== 'all' ? ' di filter ini' : ''}
            </Button>
          )}
          <Button variant="outline" onClick={() => exportSimulation(rows, sim.steps).catch((e) => toast(errMsg(e), 'error'))}>
            <FileSpreadsheet className="size-4.5" /> Ekspor simulasi ke Excel
          </Button>
        </div>
      )}
      </>
      )}

      <SectionTitle>Kalkulator cepat</SectionTitle>
      {!calc ? (
        <button onClick={() => setCalc(true)} className="w-full">
          <Card className="flex items-center gap-3 text-left">
            <Calculator className="size-5 text-brand-600" />
            <span className="flex-1 text-sm text-ink-600">Hitung harga untuk barang yang belum ada di katalog</span>
            <ChevronDown className="size-4 text-ink-400" />
          </Card>
        </button>
      ) : (
        <Card>
          <MoneyInput label="Harga kulakan (modal)" value={cost} onChange={setCost} />
          <div className="mt-3">
            <SimTable cost={cost} cfg={cfg} steps={sim.steps} recMarkup={recommend(cost, 0, cfg, 'normal', sim).markup} />
          </div>
          <div className="mt-4 border-t border-ink-100 pt-4">
            <MoneyInput label="Atau tulis harga jual sendiri" value={sell} onChange={setSell} />
            {sell > 0 && cost > 0 && (
              <div className="mt-3">
                <PriceBreakdown cost={cost} sell={sell} cfg={cfg} />
              </div>
            )}
          </div>
        </Card>
      )}

      <PricingSettings open={settings} onClose={() => setSettings(false)} />
      <ProductPricingSheet product={pick} onClose={() => setPick(null)} />
      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        requireWord={null}
        confirmLabel="Pakai saran"
        title={confirm?.length === 1 ? `Ubah harga ${confirm[0].p.name}?` : `Pakai harga saran untuk ${confirm?.length ?? 0} produk?`}
        text={
          confirm?.length === 1
            ? `Harga jual semua varian jadi ${rupiah(confirm[0].rec.price)} (sebelumnya ${rupiah(confirm[0].current)}).`
            : 'Harga jual semua varian produk tersebut diganti dengan harga saran. Kamu tetap bisa mengubahnya lagi kapan saja.'
        }
        onConfirm={async () => {
          if (confirm) await applyRecs(confirm)
          setConfirm(null)
        }}
      />
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
  const implied = impliedMarkup(v.buy_price, v.sell_price, cfg)

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
              for (const x of product.variants) {
                const s = mode === 'markup' ? priceFromMarkup(x.buy_price, markup!, cfg) : manual
                const { error } = await supabase
                  .from('variants')
                  .update({ sell_price: s, price_mode: mode, markup_pct: mode === 'markup' ? markup : null })
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
        {implied != null && v.sell_price > 0 && ` (≈ margin ${num(implied, 0)}%)`}
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
          <>
            <SimTable
              cost={v.buy_price}
              cfg={cfg}
              steps={[...new Set([...MARKUP_PRESETS, ...simCfg(profile).steps])].sort((a, b) => a - b)}
              current={v.sell_price}
              selected={markup}
              onPick={setMarkup}
            />
            <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
              <PercentInput label="Atau ketik persen sendiri" max={500} value={markup} onChange={setMarkup} />
              <p className="pb-3 text-sm font-bold text-brand-800 tabular-nums">{markup != null ? rupiah(priceFromMarkup(v.buy_price, markup, cfg)) : '–'}</p>
            </div>
          </>
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

export default function HargaPage() {
  return (
    <AdminOnly>
      <HargaPageInner />
    </AdminOnly>
  )
}
