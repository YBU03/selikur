'use client'
import { useRole } from '@/lib/roles'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { addDays, addMonths, endOfMonth, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Bell, CalendarPlus, MapPin, Pencil, Trash2, Repeat, ShoppingBasket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSchedules, useLists, useCatalog, useSalesBuckets, useProfile, defaultProfile, qk, useInvalidate } from '@/lib/queries'
import { occurrences, scheduleToIcs } from '@/lib/reminders'
import { forecastAll } from '@/lib/forecast'
import { isoDate, rupiah, tglPanjang } from '@/lib/format'
import { RECURRENCE_LABEL, type Recurrence, type Schedule } from '@/lib/types'
import { Badge, Button, Card, Confirm, Input, MoneyInput, PageHeader, Select, Sheet, Textarea, Toggle, cx, IconButton } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'
import { deliver } from '@/lib/exporters'

function Jadwal() {
  const params = useSearchParams()
  const toast = useToast()
  const invalidate = useInvalidate()
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()
  const { data: products } = useCatalog()
  const { data: buckets } = useSalesBuckets()
  const { data: profile } = useProfile()
  const { isAdmin } = useRole()
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [day, setDay] = useState(isoDate(new Date()))
  const [edit, setEdit] = useState<Schedule | 'new' | null>(params.get('baru') ? 'new' : null)
  const [del, setDel] = useState<Schedule | null>(null)
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission), [])

  const kritis = useMemo(() => forecastAll(products ?? [], buckets ?? new Map(), profile ?? defaultProfile).filter((f) => f.status === 'kritis').length, [products, buckets, profile])

  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const byDate = useMemo(() => {
    const m = new Map<string, Schedule[]>()
    for (const s of schedules ?? []) for (const d of occurrences(s, gridStart, addDays(gridStart, 42))) m.set(d, [...(m.get(d) ?? []), s])
    return m
  }, [schedules, gridStart])
  const today = isoDate(new Date())
  const selected = byDate.get(day) ?? []
  const upcoming = useMemo(() => {
    const out: { s: Schedule; d: string }[] = []
    for (const s of schedules ?? []) for (const d of occurrences(s, new Date(new Date().setHours(0, 0, 0, 0)), addDays(new Date(), 60))) out.push({ s, d })
    return out.sort((a, b) => a.d.localeCompare(b.d)).slice(0, 5)
  }, [schedules])

  return (
    <div>
      <PageHeader
        title="Jadwal Belanja"
        subtitle="Kalender kulakan & pengingat"
        back="/menu"
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setEdit('new')}>
              <Plus className="size-4" /> Jadwal
            </Button>
          )
        }
      />

      {perm !== 'granted' && perm !== 'unsupported' && (
        <button
          onClick={async () => {
            const r = await Notification.requestPermission()
            setPerm(r)
            if (r === 'granted') toast('Notifikasi aktif. Pengingat H-1 & pagi hari belanja muncul saat aplikasi dibuka.')
          }}
          className="mb-3 flex w-full items-center gap-3 rounded-3xl bg-sun-50 p-3.5 text-left ring-1 ring-sun-100"
        >
          <Bell className="size-5 text-sun-600" />
          <span className="flex-1 text-sm">
            <b className="block text-ink-800">Aktifkan notifikasi pengingat</b>
            <span className="text-ink-600">H-1 dan pagi hari belanja</span>
          </span>
        </button>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <IconButton onClick={() => setMonth(subMonths(month, 1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="size-5" />
          </IconButton>
          <p className="font-bold capitalize">{format(month, 'MMMM yyyy', { locale: localeId })}</p>
          <IconButton onClick={() => setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-400">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = isoDate(d)
            const has = byDate.get(k)
            const inMonth = isSameMonth(d, month)
            return (
              <button
                key={k}
                onClick={() => setDay(k)}
                className={cx(
                  'relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm transition',
                  !inMonth && 'text-ink-300',
                  k === day ? 'bg-brand-700 font-bold text-white' : k === today ? 'bg-brand-50 font-bold text-brand-800' : 'hover:bg-ink-50',
                )}
              >
                {d.getDate()}
                {has && <span className={cx('absolute bottom-1.5 size-1.5 rounded-full', k === day ? 'bg-sun-300' : 'bg-sun-500')} />}
              </button>
            )
          })}
        </div>
      </Card>

      <p className="mt-5 mb-2 px-1 text-sm font-semibold text-ink-600">{tglPanjang(day)}</p>
      {selected.length === 0 && !isAdmin ? (
        <p className="rounded-3xl border border-dashed border-ink-200 py-5 text-center text-sm text-ink-500">Tidak ada jadwal di tanggal ini.</p>
      ) : selected.length === 0 ? (
        <button onClick={() => setEdit('new')} className="w-full rounded-3xl border border-dashed border-ink-200 py-5 text-sm text-ink-500">
          Tidak ada jadwal. <span className="font-semibold text-brand-700">+ Buat jadwal di tanggal ini</span>
        </button>
      ) : (
        <div className="space-y-2.5">
          {selected.map((s) => (
            <ScheduleCard key={s.id} s={s} date={day} list={lists?.find((l) => l.schedule_id === s.id)} kritis={kritis} canEdit={isAdmin} onEdit={() => setEdit(s)} onDelete={() => setDel(s)} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <p className="mt-6 mb-2 px-1 text-[13px] font-semibold tracking-wide text-ink-500 uppercase">Akan datang</p>
          <Card className="divide-y divide-ink-100 p-0">
            {upcoming.map(({ s, d }) => (
              <button key={`${s.id}${d}`} onClick={() => (setDay(d), setMonth(startOfMonth(new Date(d))))} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="w-24 text-sm font-semibold text-brand-700">{tglPanjang(d, 'EEE, d MMM')}</span>
                <span className="flex-1 truncate text-sm">{s.title}</span>
                {s.recurrence !== 'none' && <Repeat className="size-3.5 text-ink-400" />}
              </button>
            ))}
          </Card>
        </>
      )}

      <ScheduleSheet
        open={!!edit}
        schedule={edit === 'new' ? null : edit}
        defaultDate={day}
        defaultBudget={(profile ?? defaultProfile).default_budget}
        onClose={() => setEdit(null)}
        onSaved={() => invalidate(qk.schedules)}
      />
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        title={`Hapus jadwal "${del?.title}"?`}
        text={del?.recurrence !== 'none' ? 'Semua pengulangan jadwal ini ikut terhapus. Daftar belanjanya tetap ada.' : 'Daftar belanja yang terhubung tetap ada.'}
        onConfirm={async () => {
          const { error } = await supabase.from('schedules').delete().eq('id', del!.id)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.schedules, qk.lists)
          toast('Jadwal dihapus')
          setDel(null)
        }}
      />
    </div>
  )
}

function ScheduleCard({
  s,
  date,
  list,
  kritis,
  canEdit,
  onEdit,
  onDelete,
}: {
  s: Schedule
  date: string
  list?: { id: string; title: string; status: string; planned_total: number }
  kritis: number
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{s.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
            {s.scheduled_time && <span>{s.scheduled_time.slice(0, 5)}</span>}
            {s.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {s.location}
              </span>
            )}
            {s.budget && <span>Anggaran {rupiah(s.budget)}</span>}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <Badge>{RECURRENCE_LABEL[s.recurrence]}</Badge>
            {(s.remind_day_before || s.remind_morning) && (
              <Badge tone="green">
                <Bell className="size-3" /> {[s.remind_day_before && 'H-1', s.remind_morning && 'Pagi'].filter(Boolean).join(' & ')}
              </Badge>
            )}
          </div>
        </div>
        {canEdit && (
          <>
            <button onClick={onEdit} className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Ubah">
              <Pencil className="size-4" />
            </button>
            <button onClick={onDelete} className="flex size-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50" aria-label="Hapus">
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
      {kritis > 0 && date >= isoDate(new Date()) && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{kritis} varian berstatus Kritis — pastikan masuk daftar belanja.</p>
      )}
      <div className="mt-3 flex gap-2">
        {list ? (
          <Link href={`/belanja/detail?id=${list.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand-700 py-2.5 text-sm font-semibold text-white">
            <ShoppingBasket className="size-4" /> {list.title}
          </Link>
        ) : (
          <Link href="/forecast" className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-800">
            <ShoppingBasket className="size-4" /> Siapkan daftar
          </Link>
        )}
        <button
          onClick={() => deliver(new Blob([scheduleToIcs(s, location.origin)], { type: 'text/calendar' }), `kulakan-${s.scheduled_on}.ics`, 'download')}
          className="flex items-center justify-center gap-1.5 rounded-2xl bg-ink-100 px-3.5 py-2.5 text-sm font-semibold text-ink-700"
        >
          <CalendarPlus className="size-4" /> Kalender HP
        </button>
      </div>
    </Card>
  )
}

function ScheduleSheet({
  open,
  schedule,
  defaultDate,
  defaultBudget,
  onClose,
  onSaved,
}: {
  open: boolean
  schedule: Schedule | null
  defaultDate: string
  defaultBudget: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [f, setF] = useState<Omit<Schedule, 'id'>>({} as Omit<Schedule, 'id'>)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setF(
      schedule ?? {
        title: 'Kulakan',
        scheduled_on: defaultDate,
        scheduled_time: '08:00',
        recurrence: 'none',
        location: '',
        budget: defaultBudget,
        remind_day_before: true,
        remind_morning: true,
        notes: '',
      },
    )
  }, [open, schedule, defaultDate, defaultBudget])
  return (
    <Sheet open={open} onClose={onClose} title={schedule ? 'Ubah jadwal' : 'Jadwal baru'}>
      <div className="space-y-3.5">
        <Input label="Judul" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Tanggal" type="date" value={f.scheduled_on ?? ''} onChange={(e) => setF({ ...f, scheduled_on: e.target.value })} />
          <Input label="Jam" type="time" value={f.scheduled_time?.slice(0, 5) ?? ''} onChange={(e) => setF({ ...f, scheduled_time: e.target.value || null })} />
        </div>
        <Select label="Pengulangan" value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value as Recurrence })}>
          {Object.entries(RECURRENCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="Lokasi" placeholder="mis. Pasar Pagi Asemka" value={f.location ?? ''} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <MoneyInput label="Anggaran" value={f.budget} onChange={(n) => setF({ ...f, budget: n || null })} />
        <div className="rounded-2xl bg-ink-50 px-3">
          <Toggle label="Ingatkan H-1" checked={!!f.remind_day_before} onChange={(v) => setF({ ...f, remind_day_before: v })} />
          <Toggle label="Ingatkan pagi hari belanja" checked={!!f.remind_morning} onChange={(v) => setF({ ...f, remind_morning: v })} />
        </div>
        <Textarea label="Catatan" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <p className="text-xs text-ink-500">Tip: tekan “Kalender HP” di kartu jadwal agar pengingat tetap muncul walau aplikasi tertutup.</p>
        <Button
          block
          loading={busy}
          disabled={!f.title?.trim() || !f.scheduled_on}
          onClick={async () => {
            setBusy(true)
            const row = { ...f, location: f.location || null, notes: f.notes || null }
            const res = schedule ? await supabase.from('schedules').update(row).eq('id', schedule.id) : await supabase.from('schedules').insert(row)
            setBusy(false)
            if (res.error) return toast(errMsg(res.error), 'error')
            onSaved()
            toast('Jadwal tersimpan')
            onClose()
          }}
        >
          Simpan jadwal
        </Button>
      </div>
    </Sheet>
  )
}

export default function Page() {
  return (
    <Suspense>
      <Jadwal />
    </Suspense>
  )
}
