'use client'
import { useRole } from '@/lib/roles'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingBasket, Plus, LineChart, ChevronRight, CheckCircle2, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLists, useSchedules, useProfile, defaultProfile, qk, useInvalidate } from '@/lib/queries'
import { rupiah, tgl } from '@/lib/format'
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Segmented, Skeleton, cx } from '@/components/ui'
import CreateListSheet from '@/components/CreateListSheet'
import { useToast, errMsg } from '@/components/Toast'
import { LIST_STATUS } from '@/lib/types'

export default function BelanjaPage() {
  const router = useRouter()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: lists, isPending } = useLists()
  const { data: schedules } = useSchedules()
  const { data: profile } = useProfile()
  const { isAdmin } = useRole()
  const [tab, setTab] = useState<'aktif' | 'selesai'>('aktif')
  const [sheet, setSheet] = useState(false)

  const shown = (lists ?? []).filter((l) => (tab === 'aktif' ? l.status !== 'done' : l.status === 'done'))
  const schedMap = new Map((schedules ?? []).map((s) => [s.id, s]))

  return (
    <div>
      <PageHeader
        title="Daftar Belanja"
        subtitle="Rencana kulakan & realisasi"
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setSheet(true)}>
              <Plus className="size-4" /> Daftar
            </Button>
          )
        }
      />
      <Link href="/forecast" className="mb-4 flex items-center gap-3 rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <LineChart className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-brand-900">Buat otomatis dari forecast</span>
          <span className="block text-sm text-brand-700">Varian Kritis & Perlu Kulak langsung masuk daftar</span>
        </span>
        <ChevronRight className="size-5 text-brand-700" />
      </Link>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'aktif', label: `Aktif (${(lists ?? []).filter((l) => l.status !== 'done').length})` },
          { value: 'selesai', label: 'Selesai' },
        ]}
      />

      <div className="mt-4 space-y-3">
        {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        {!isPending && shown.length === 0 && (
          <EmptyState
            icon={ShoppingBasket}
            title={tab === 'aktif' ? 'Belum ada daftar aktif' : 'Belum ada belanja selesai'}
            text="Buat dari forecast agar jumlah kulakan sesuai data penjualan."
            action={<ButtonLink href="/forecast" size="sm">Lihat forecast</ButtonLink>}
          />
        )}
        {shown.map((l) => {
          const count = l.shopping_items?.[0]?.count ?? 0
          const s = l.schedule_id ? schedMap.get(l.schedule_id) : undefined
          const total = l.status === 'done' ? Number(l.actual_total) : Number(l.planned_total)
          const over = l.budget != null && Number(l.budget) > 0 && Number(l.planned_total) > Number(l.budget)
          const usage = l.budget ? Math.min(1, total / Number(l.budget)) : null
          return (
            <Link key={l.id} href={`/belanja/detail?id=${l.id}`}>
              <Card className="transition active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-2xl', l.status === 'done' ? 'bg-leaf-500/10 text-leaf-600' : 'bg-sun-50 text-sun-600')}>
                    {l.status === 'done' ? <CheckCircle2 className="size-5" /> : <ShoppingBasket className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{l.title}</p>
                      <Badge tone={LIST_STATUS[l.status].tone}>{LIST_STATUS[l.status].label}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                      {count} barang
                      {s && (
                        <>
                          · <CalendarDays className="size-3" /> {tgl(s.scheduled_on)}
                        </>
                      )}
                      {l.completed_at && ` · selesai ${tgl(l.completed_at)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{rupiah(total)}</p>
                    <p className="text-[11px] text-ink-500">{l.status === 'done' ? 'realisasi' : 'estimasi'}</p>
                  </div>
                </div>
                {usage != null && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className={cx('h-full rounded-full', over ? 'bg-red-500' : 'bg-brand-500')} style={{ width: `${usage * 100}%` }} />
                    </div>
                    <p className={cx('mt-1 text-[11px]', over ? 'font-semibold text-red-600' : 'text-ink-500')}>
                      {over ? 'Melebihi anggaran ' : 'Anggaran '}
                      {rupiah(l.budget)}
                    </p>
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>

      <CreateListSheet
        open={sheet}
        onClose={() => setSheet(false)}
        defaultBudget={(profile ?? defaultProfile).default_budget}
        schedules={(schedules ?? []).filter((s) => !(lists ?? []).some((l) => l.schedule_id === s.id))}
        onCreate={async ({ title, budget, scheduleId }) => {
          const { data, error } = await supabase.from('shopping_lists').insert({ title, budget: budget || null, schedule_id: scheduleId || null }).select().single()
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.lists)
          router.push(`/belanja/detail?id=${data.id}`)
        }}
      />
    </div>
  )
}
