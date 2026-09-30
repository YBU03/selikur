'use client'
import { useEffect, useState } from 'react'
import { rupiah, tgl } from '@/lib/format'
import { Button, Input, MoneyInput, Select, Sheet } from './ui'

export default function CreateListSheet({
  open,
  onClose,
  onCreate,
  total,
  defaultBudget,
  schedules,
  nextDate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (v: { title: string; budget: number; scheduleId: string }) => Promise<void>
  total?: number
  defaultBudget?: number | null
  schedules: { id: string; title: string; scheduled_on: string }[]
  nextDate?: string
}) {
  const [title, setTitle] = useState('')
  const [budget, setBudget] = useState(0)
  const [scheduleId, setScheduleId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setTitle(`Kulakan ${tgl(nextDate ?? new Date())}`)
    setBudget(defaultBudget ?? 0)
    setScheduleId(schedules.find((s) => s.scheduled_on === nextDate)?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="Daftar belanja baru">
      <div className="space-y-3.5">
        <Input label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
        <MoneyInput label="Batas anggaran (opsional)" value={budget} onChange={setBudget} />
        {total != null && budget > 0 && total > budget && (
          <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">Estimasi {rupiah(total)} melebihi anggaran {rupiah(budget)}.</p>
        )}
        <Select label="Hubungkan ke jadwal" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
          <option value="">Tanpa jadwal</option>
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {tgl(s.scheduled_on)} — {s.title}
            </option>
          ))}
        </Select>
        <Button
          block
          loading={busy}
          disabled={!title.trim()}
          onClick={async () => {
            setBusy(true)
            await onCreate({ title: title.trim(), budget, scheduleId })
            setBusy(false)
          }}
        >
          Buat daftar
        </Button>
      </div>
    </Sheet>
  )
}
