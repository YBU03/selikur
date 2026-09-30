'use client'
import { AdminOnly } from '@/components/AppShell'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths, subWeeks, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight, FileText, FileSpreadsheet, Share2, TrendingUp, TrendingDown } from 'lucide-react'
import { useCatalog, useCategories, useSuppliers, useProfile, defaultProfile } from '@/lib/queries'
import { computeRecap, fetchRecapItems, type Group } from '@/lib/recap'
import { exportRecapExcel, exportRecapPdf } from '@/lib/exporters'
import { num, pct, rupiah, tgl, tglPanjang } from '@/lib/format'
import { Button, Card, EmptyState, IconButton, Loading, PageHeader, SectionTitle, Segmented, Sheet, cx } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'

type Period = 'minggu' | 'bulan'

function range(period: Period, anchor: Date) {
  if (period === 'minggu') {
    const from = startOfWeek(anchor, { weekStartsOn: 1 })
    return { from, to: addDays(endOfWeek(anchor, { weekStartsOn: 1 }), 1) }
  }
  const from = startOfMonth(anchor)
  return { from, to: addDays(endOfMonth(anchor), 1) }
}

function RekapPageInner() {
  const toast = useToast()
  const [period, setPeriod] = useState<Period>('bulan')
  const [anchor, setAnchor] = useState(new Date())
  const [share, setShare] = useState(false)
  const { data: products } = useCatalog()
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()
  const { data: profile } = useProfile()

  const cur = range(period, anchor)
  const prevAnchor = period === 'minggu' ? subWeeks(anchor, 1) : subMonths(anchor, 1)
  const prev = range(period, prevAnchor)

  const { data: items, isPending } = useQuery({
    queryKey: ['recap', period, cur.from.toISOString()],
    queryFn: () => fetchRecapItems(cur.from, cur.to),
  })
  const { data: prevItems } = useQuery({
    queryKey: ['recap', period, prev.from.toISOString()],
    queryFn: () => fetchRecapItems(prev.from, prev.to),
  })

  const r = useMemo(() => computeRecap(items ?? [], products ?? [], categories ?? [], suppliers ?? []), [items, products, categories, suppliers])
  const p = useMemo(() => (prevItems ? computeRecap(prevItems, products ?? [], categories ?? [], suppliers ?? []) : null), [prevItems, products, categories, suppliers])
  const change = p && p.total > 0 ? (r.total - p.total) / p.total : null
  const label = period === 'minggu' ? `Minggu ${tgl(cur.from)} – ${tgl(addDays(cur.to, -1))}` : tglPanjang(cur.from, 'MMMM yyyy')
  const title = period === 'minggu' ? `Minggu ${tgl(cur.from)}` : tglPanjang(cur.from, 'MMMM yyyy')
  const store = (profile ?? defaultProfile).store_name

  async function run(fn: () => Promise<void>) {
    setShare(false)
    try {
      await fn()
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Rekap Belanja"
        subtitle="Total modal keluar"
        back="/menu"
        action={
          <Button size="sm" variant="soft" onClick={() => setShare(true)} disabled={!r.itemsPlanned}>
            <Share2 className="size-4" /> Ekspor
          </Button>
        }
      />
      <Segmented
        value={period}
        onChange={(v) => (setPeriod(v), setAnchor(new Date()))}
        options={[
          { value: 'minggu', label: 'Mingguan' },
          { value: 'bulan', label: 'Bulanan' },
        ]}
      />
      <div className="my-3 flex items-center justify-between">
        <IconButton onClick={() => setAnchor(period === 'minggu' ? subWeeks(anchor, 1) : subMonths(anchor, 1))} aria-label="Sebelumnya">
          <ChevronLeft className="size-5" />
        </IconButton>
        <p className="font-semibold capitalize">{label}</p>
        <IconButton onClick={() => setAnchor(period === 'minggu' ? addWeeks(anchor, 1) : addMonths(anchor, 1))} aria-label="Berikutnya">
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      {isPending ? (
        <Loading />
      ) : !r.itemsPlanned ? (
        <EmptyState title="Belum ada belanja selesai di periode ini" text="Rekap terisi otomatis setiap kamu menyelesaikan mode belanja." />
      ) : (
        <>
          <div className="rounded-[2rem] bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white shadow-lift">
            <p className="text-sm text-brand-100">Total belanja</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{rupiah(r.total)}</p>
            {change != null && (
              <p className={cx('mt-1 flex items-center gap-1 text-sm font-semibold', change > 0 ? 'text-sun-300' : 'text-leaf-400')}>
                {change > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {change > 0 ? 'Naik' : 'Turun'} {pct(Math.abs(change))} dari periode lalu ({rupiah(p!.total)})
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Kali belanja', num(r.lists)],
                ['Item terbeli', `${num(r.itemsBought)}/${num(r.itemsPlanned)}`],
                ['Total pcs', num(r.pcs)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/10 py-2">
                  <p className="text-lg font-bold">{v}</p>
                  <p className="text-[11px] text-brand-100">{k}</p>
                </div>
              ))}
            </div>
          </div>

          <SectionTitle>Rencana vs realisasi</SectionTitle>
          <Card className="space-y-2.5">
            <Bar label="Rencana" value={r.planned} max={Math.max(r.planned, r.total)} tone="bg-ink-300" />
            <Bar label="Realisasi" value={r.total} max={Math.max(r.planned, r.total)} tone="bg-brand-500" />
            <p className="text-xs text-ink-500">
              Selisih <b className={r.total > r.planned ? 'text-red-600' : 'text-leaf-600'}>{rupiah(r.total - r.planned)}</b> · kesesuaian rencana{' '}
              <b className={cx((r.fulfillment ?? 0) >= 0.9 ? 'text-leaf-600' : 'text-sun-600')}>{pct(r.fulfillment)}</b> (target ≥ 90%)
              {r.itemsUnavailable > 0 && ` · ${r.itemsUnavailable} tidak tersedia`}
            </p>
          </Card>

          <Breakdown title="Per kategori" groups={r.byCategory} total={r.total} />
          <Breakdown title="Per supplier" groups={r.bySupplier} total={r.total} />
          <Breakdown title="Per produk" groups={r.byProduct} total={r.total} limit={10} />
        </>
      )}

      <Sheet open={share} onClose={() => setShare(false)} title="Ekspor rekap">
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => run(() => exportRecapPdf(title, label, r, p, store, 'download'))}>
            <FileText className="size-4.5" /> Unduh PDF
          </Button>
          <Button variant="outline" onClick={() => run(() => exportRecapExcel(title, r, 'download'))}>
            <FileSpreadsheet className="size-4.5" /> Unduh Excel (data mentah + rekap)
          </Button>
          <Button onClick={() => run(() => exportRecapPdf(title, label, r, p, store, 'share'))}>
            <Share2 className="size-4.5" /> Bagikan PDF ke WhatsApp
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-semibold tabular-nums">{rupiah(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

function Breakdown({ title, groups, total, limit }: { title: string; groups: Group[]; total: number; limit?: number }) {
  if (!groups.length) return null
  const max = groups[0].amount || 1
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card className="space-y-3">
        {groups.slice(0, limit ?? groups.length).map((g) => (
          <div key={g.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{g.name}</span>
              <span className="shrink-0 tabular-nums">
                <b>{rupiah(g.amount)}</b> <span className="text-xs text-ink-400">{pct(total ? g.amount / total : 0)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500" style={{ width: `${(g.amount / max) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-ink-400">{num(g.pcs)} pcs</p>
          </div>
        ))}
      </Card>
    </>
  )
}

export default function RekapPage() {
  return (
    <AdminOnly>
      <RekapPageInner />
    </AdminOnly>
  )
}
