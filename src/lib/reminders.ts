'use client'
import { useEffect } from 'react'
import { addDays, addMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { useSchedules, useLists } from './queries'
import type { Schedule } from './types'
import { isoDate, tglPanjang } from './format'

/** Tanggal kemunculan jadwal (termasuk pengulangan) dalam rentang. */
export function occurrences(s: Schedule, from: Date, to: Date): string[] {
  const out: string[] = []
  let d = parseISO(s.scheduled_on)
  let guard = 0
  while (d <= to && guard++ < 400) {
    if (d >= from) out.push(isoDate(d))
    if (s.recurrence === 'none') break
    d = s.recurrence === 'weekly' ? addDays(d, 7) : s.recurrence === 'biweekly' ? addDays(d, 14) : addMonths(d, 1)
  }
  return out
}

/** Jadwal berikutnya (hari ini atau setelahnya) dari daftar jadwal. */
export function nextSchedule(schedules: Schedule[] | undefined, doneScheduleIds: Set<string> = new Set()) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let best: { schedule: Schedule; date: string } | null = null
  for (const s of schedules ?? []) {
    if (doneScheduleIds.has(s.id) && s.recurrence === 'none') continue
    const occ = occurrences(s, today, addDays(today, 120)).find((d) => !(doneScheduleIds.has(s.id) && d === s.scheduled_on))
    if (occ && (!best || occ < best.date)) best = { schedule: s, date: occ }
  }
  return best
}

export async function notify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/favicon-64.png' })
    else new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
  } catch {
    /* abaikan */
  }
}

/** Pengingat H-1 dan pagi hari belanja, dikirim saat aplikasi dibuka. */
export function useReminders() {
  const { data: schedules } = useSchedules()
  const { data: lists } = useLists()
  useEffect(() => {
    if (!schedules?.length) return
    const done = new Set((lists ?? []).filter((l) => l.status === 'done' && l.schedule_id).map((l) => l.schedule_id!))
    const next = nextSchedule(schedules, done)
    if (!next) return
    const days = differenceInCalendarDays(parseISO(next.date), new Date())
    const hour = new Date().getHours()
    const s = next.schedule
    let kind: string | null = null
    if (days === 1 && s.remind_day_before) kind = 'h-1'
    if (days === 0 && s.remind_morning && hour >= 5) kind = 'hari-h'
    if (!kind) return
    const key = `selikur-notif-${s.id}-${next.date}-${kind}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    void notify(
      kind === 'h-1' ? 'Besok jadwal kulakan' : 'Hari ini jadwal kulakan',
      `${s.title}${s.location ? ` di ${s.location}` : ''} — ${tglPanjang(next.date, 'EEEE, d MMM')}. Cek daftar belanja kamu.`,
      key,
    )
  }, [schedules, lists])
}

/** File .ics agar pengingat muncul di kalender HP walau aplikasi tertutup. */
export function scheduleToIcs(s: Schedule, origin: string) {
  const d = s.scheduled_on.replace(/-/g, '')
  const time = (s.scheduled_time ?? '08:00').slice(0, 5).replace(':', '') + '00'
  const rrule =
    s.recurrence === 'weekly' ? 'RRULE:FREQ=WEEKLY' : s.recurrence === 'biweekly' ? 'RRULE:FREQ=WEEKLY;INTERVAL=2' : s.recurrence === 'monthly' ? 'RRULE:FREQ=MONTHLY' : null
  const esc = (t: string) => t.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Selikur//ID',
    'BEGIN:VEVENT',
    `UID:${s.id}@selikur`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${time}`,
    'DURATION:PT2H',
    rrule,
    `SUMMARY:${esc(`Kulakan: ${s.title}`)}`,
    s.location ? `LOCATION:${esc(s.location)}` : null,
    `DESCRIPTION:${esc(`Buka daftar belanja di ${origin}/jadwal`)}`,
    s.remind_day_before ? 'BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:Besok kulakan\nTRIGGER:-P1D\nEND:VALARM' : null,
    s.remind_morning ? 'BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:Hari ini kulakan\nTRIGGER:-PT1H\nEND:VALARM' : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n').replace(/\n/g, '\r\n').replace(/\r\r/g, '\r')
}
