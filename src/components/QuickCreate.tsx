'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { qk, useInvalidate } from '@/lib/queries'
import { Button, Input, Sheet, Textarea } from './ui'
import { useToast, errMsg } from './Toast'
import type { Category, Supplier } from '@/lib/types'

/** Sheet cepat untuk membuat kategori atau supplier baru dari form mana pun. */
export function NewCategorySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (c: Category) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidate()
  const toast = useToast()
  return (
    <Sheet open={open} onClose={onClose} title="Kategori baru">
      <Input autoFocus label="Nama kategori" placeholder="mis. Tumbler, Botol Minum, Lunch Box" value={name} onChange={(e) => setName(e.target.value)} />
      <p className="mt-2 text-xs text-ink-500">Atribut tambahan (mis. kapasitas ml) bisa diatur di Pengaturan → Kategori.</p>
      <Button
        block
        className="mt-5"
        loading={busy}
        disabled={!name.trim()}
        onClick={async () => {
          setBusy(true)
          const { data, error } = await supabase.from('categories').insert({ name: name.trim() }).select().single()
          setBusy(false)
          if (error) return toast(errMsg(error), 'error')
          await invalidate(qk.categories)
          onCreated?.(data as Category)
          setName('')
          onClose()
        }}
      >
        Simpan
      </Button>
    </Sheet>
  )
}

export function SupplierSheet({
  open,
  onClose,
  onSaved,
  supplier,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (s: Supplier) => void
  supplier?: Supplier | null
}) {
  const [form, setForm] = useState<Partial<Supplier>>(supplier ?? {})
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidate()
  const toast = useToast()
  const key = supplier?.id ?? 'new'
  return (
    <Sheet open={open} onClose={onClose} title={supplier ? 'Ubah supplier' : 'Supplier baru'} key={key}>
      <div className="space-y-3.5">
        <Input autoFocus label="Nama" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Lokasi / alamat" placeholder="mis. Pasar Asemka Blok B-12" value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Input label="No. WhatsApp" inputMode="tel" placeholder="08xxxxxxxxxx" value={form.whatsapp ?? ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <Textarea label="Catatan" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Button
        block
        className="mt-5"
        loading={busy}
        disabled={!form.name?.trim()}
        onClick={async () => {
          setBusy(true)
          const row = { name: form.name!.trim(), location: form.location || null, whatsapp: form.whatsapp || null, notes: form.notes || null }
          const res = supplier
            ? await supabase.from('suppliers').update(row).eq('id', supplier.id).select().single()
            : await supabase.from('suppliers').insert(row).select().single()
          setBusy(false)
          if (res.error) return toast(errMsg(res.error), 'error')
          await invalidate(qk.suppliers)
          onSaved?.(res.data as Supplier)
          onClose()
        }}
      >
        Simpan
      </Button>
    </Sheet>
  )
}

export function waLink(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0/, '62')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
