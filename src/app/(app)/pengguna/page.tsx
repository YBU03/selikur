'use client'
import { useState } from 'react'
import { Check, X, UserCog, ShieldCheck, Shield, User, Power, Info, UserPlus, Eye, EyeOff, Wand2, Copy, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useMembers, useInvalidate, qk } from '@/lib/queries'
import { useRole } from '@/lib/roles'
import { tgl } from '@/lib/format'
import { MEMBER_STATUS_LABEL, ROLE_LABEL, type Member, type MemberStatus, type Role } from '@/lib/types'
import { AdminOnly } from '@/components/AppShell'
import { Badge, Button, Card, Confirm, EmptyState, Input, Loading, PageHeader, SectionTitle, Sheet, cx } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  super_admin: ShieldCheck,
  admin: Shield,
  user: User,
}

const ROLE_DESC: Record<Role, string> = {
  super_admin: 'Semua akses + kelola semua pengguna termasuk admin',
  admin: 'Kelola produk, harga, belanja, jadwal, rekap, dan menyetujui pengguna',
  user: 'Lihat katalog & forecast, foto produk, catat penjualan, centang belanja',
}

export default function PenggunaPage() {
  return (
    <AdminOnly>
      <Pengguna />
    </AdminOnly>
  )
}

function Pengguna() {
  const toast = useToast()
  const invalidate = useInvalidate()
  const { me, isSuper } = useRole()
  const { data: members, isPending } = useMembers()
  const [edit, setEdit] = useState<Member | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<{ m: Member; status: MemberStatus; title: string; text: string; label: string } | null>(null)

  async function set(m: Member, role: Role, status: MemberStatus, msg: string) {
    const { error } = await supabase.rpc('set_member', { p_user: m.id, p_role: role, p_status: status })
    if (error) return toast(errMsg(error), 'error')
    await invalidate(qk.members)
    toast(msg)
  }

  const canManage = (m: Member) => m.id !== me?.id && (isSuper || m.role !== 'super_admin')
  const pending = (members ?? []).filter((m) => m.status === 'pending')
  const active = (members ?? []).filter((m) => m.status === 'approved')
  const inactive = (members ?? []).filter((m) => m.status === 'rejected' || m.status === 'disabled')

  const Row = ({ m }: { m: Member }) => {
    const Icon = ROLE_ICON[m.role]
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-2xl', m.role === 'super_admin' ? 'bg-sun-50 text-sun-600' : m.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600')}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {m.full_name || m.email}
            {m.id === me?.id && <span className="ml-1 text-xs font-normal text-ink-400">(kamu)</span>}
          </p>
          <p className="truncate text-xs text-ink-500">{m.email}</p>
          <div className="mt-1 flex gap-1.5">
            <Badge tone={m.role === 'super_admin' ? 'orange' : m.role === 'admin' ? 'green' : 'gray'}>{ROLE_LABEL[m.role]}</Badge>
            {m.status !== 'approved' && <Badge tone={m.status === 'pending' ? 'orange' : 'red'}>{MEMBER_STATUS_LABEL[m.status]}</Badge>}
          </div>
        </div>
        {canManage(m) && m.status !== 'pending' && (
          <button onClick={() => setEdit(m)} className="flex size-10 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100" aria-label="Kelola">
            <UserCog className="size-5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Kelola Pengguna"
        subtitle={`${active.length} aktif · ${pending.length} menunggu`}
        back="/menu"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Tambah
          </Button>
        }
      />

      <Card className="flex gap-3 bg-brand-50/60 ring-brand-100">
        <Info className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <p className="text-sm text-ink-700">
          Dua cara menambah orang kantor: <b>tambah langsung</b> di sini (kamu buatkan email & kata sandinya, langsung aktif), atau mereka <b>daftar sendiri</b> lalu kamu
          setujui sebagai <b>User</b> atau <b>Admin</b>.
        </p>
      </Card>

      <AddUserSheet open={adding} onClose={() => setAdding(false)} canSuper={isSuper} onCreated={() => invalidate(qk.members)} />

      {isPending && <Loading />}

      <SectionTitle>Menunggu persetujuan</SectionTitle>
      {pending.length === 0 ? (
        <p className="px-1 text-sm text-ink-500">Tidak ada pendaftaran baru.</p>
      ) : (
        <div className="space-y-2.5">
          {pending.map((m) => (
            <Card key={m.id} className="ring-sun-200">
              <p className="font-semibold">{m.full_name || m.email}</p>
              <p className="text-sm text-ink-500">
                {m.email} · daftar {tgl(m.created_at)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => set(m, 'user', 'approved', `${m.full_name ?? m.email} disetujui sebagai User`)}>
                  <Check className="size-4" /> Setujui User
                </Button>
                <Button size="sm" variant="soft" onClick={() => set(m, 'admin', 'approved', `${m.full_name ?? m.email} disetujui sebagai Admin`)}>
                  <Shield className="size-4" /> Jadikan Admin
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                block
                className="mt-1 text-red-600"
                onClick={() =>
                  setConfirm({ m, status: 'rejected', title: `Tolak ${m.full_name ?? m.email}?`, text: 'Akun ini tidak akan bisa mengakses data toko.', label: 'Tolak' })
                }
              >
                <X className="size-4" /> Tolak
              </Button>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Anggota aktif</SectionTitle>
      <Card className="divide-y divide-ink-100 p-0">
        {active.map((m) => (
          <Row key={m.id} m={m} />
        ))}
      </Card>

      {inactive.length > 0 && (
        <>
          <SectionTitle>Ditolak / nonaktif</SectionTitle>
          <Card className="divide-y divide-ink-100 p-0">
            {inactive.map((m) => (
              <Row key={m.id} m={m} />
            ))}
          </Card>
        </>
      )}

      {!isPending && !members?.length && <EmptyState title="Belum ada pengguna" />}

      <SectionTitle>Hak akses tiap peran</SectionTitle>
      <Card className="space-y-3">
        {(['super_admin', 'admin', 'user'] as Role[]).map((r) => {
          const Icon = ROLE_ICON[r]
          return (
            <div key={r} className="flex gap-3">
              <Icon className="mt-0.5 size-4.5 shrink-0 text-brand-700" />
              <p className="text-sm">
                <b>{ROLE_LABEL[r]}</b> <span className="text-ink-500">— {ROLE_DESC[r]}</span>
              </p>
            </div>
          )
        })}
      </Card>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.full_name || edit?.email || 'Pengguna'}>
        {edit && (
          <div className="space-y-2">
            <p className="text-sm text-ink-500">Ubah peran</p>
            {(['user', 'admin', ...(isSuper ? (['super_admin'] as Role[]) : [])] as Role[]).map((r) => {
              const Icon = ROLE_ICON[r]
              const on = edit.role === r
              return (
                <button
                  key={r}
                  onClick={async () => {
                    await set(edit, r, edit.status === 'approved' ? 'approved' : edit.status, `Peran diubah menjadi ${ROLE_LABEL[r]}`)
                    setEdit(null)
                  }}
                  className={cx('flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1', on ? 'bg-brand-50 ring-brand-300' : 'ring-ink-100 hover:bg-ink-50')}
                >
                  <Icon className="mt-0.5 size-5 text-brand-700" />
                  <span className="flex-1">
                    <b className="block">{ROLE_LABEL[r]}</b>
                    <span className="text-xs text-ink-500">{ROLE_DESC[r]}</span>
                  </span>
                  {on && <Check className="size-5 text-brand-700" />}
                </button>
              )
            })}
            <div className="pt-3">
              {edit.status === 'approved' ? (
                <Button
                  variant="danger"
                  block
                  onClick={() => {
                    setConfirm({ m: edit, status: 'disabled', title: `Nonaktifkan ${edit.full_name ?? edit.email}?`, text: 'Akun ini tidak bisa mengakses data toko sampai diaktifkan lagi. Data yang sudah dicatat tetap ada.', label: 'Nonaktifkan' })
                    setEdit(null)
                  }}
                >
                  <Power className="size-4" /> Nonaktifkan akun
                </Button>
              ) : (
                <Button
                  block
                  onClick={async () => {
                    await set(edit, edit.role, 'approved', 'Akun diaktifkan kembali')
                    setEdit(null)
                  }}
                >
                  <Check className="size-4" /> Aktifkan kembali
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        requireWord={null}
        confirmLabel={confirm?.label}
        title={confirm?.title ?? ''}
        text={confirm?.text}
        onConfirm={async () => {
          if (!confirm) return
          await set(confirm.m, confirm.m.role, confirm.status, confirm.status === 'rejected' ? 'Pendaftaran ditolak' : 'Akun dinonaktifkan')
          setConfirm(null)
        }}
      />
    </div>
  )
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => chars[n % chars.length]).join('')
}

/** Admin membuat akun langsung aktif untuk orang kantor (lewat Edge Function admin-create-user). */
function AddUserSheet({ open, onClose, canSuper, onCreated }: { open: boolean; onClose: () => void; canSuper: boolean; onCreated: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(true)
  const [role, setRole] = useState<Role>('user')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ name: string; email: string; password: string; role: Role } | null>(null)

  function reset() {
    setName('')
    setEmail('')
    setPassword(randomPassword())
    setRole('user')
    setDone(null)
  }

  const shareText = done
    ? `Halo ${done.name}, akun Selikur kamu sudah dibuat.\n\nBuka: ${typeof location !== 'undefined' ? location.origin : ''}\nEmail: ${done.email}\nKata sandi: ${done.password}\nPeran: ${ROLE_LABEL[done.role]}\n\nSilakan masuk lewat tab "Masuk".`
    : ''

  async function submit() {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: email.trim(), password, full_name: name.trim(), role },
      })
      if (error) {
        let msg = error.message
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          try {
            msg = (await ctx.json()).error ?? msg
          } catch {
            /* abaikan */
          }
        }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      setDone({ name: name.trim(), email: email.trim().toLowerCase(), password, role })
      onCreated()
      toast('Pengguna berhasil dibuat')
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose()
        setDone(null)
      }}
      title={done ? 'Akun berhasil dibuat' : 'Tambah pengguna'}
    >
      {done ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-leaf-500/10 p-4 ring-1 ring-leaf-500/20">
            <p className="text-sm text-ink-600">Berikan data masuk ini ke {done.name}:</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Email</dt>
                <dd className="font-semibold">{done.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Kata sandi</dt>
                <dd className="font-mono font-semibold">{done.password}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Peran</dt>
                <dd className="font-semibold">{ROLE_LABEL[done.role]}</dd>
              </div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard?.writeText(shareText)
                toast('Disalin')
              }}
            >
              <Copy className="size-4" /> Salin
            </Button>
            <Button variant="soft" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}>
              <MessageCircle className="size-4" /> Kirim WA
            </Button>
          </div>
          <Button block onClick={reset}>
            <UserPlus className="size-4" /> Tambah pengguna lain
          </Button>
          <p className="text-xs text-ink-500">Sarankan pengguna mengganti kata sandi setelah masuk pertama kali lewat menu Lainnya → Ganti kata sandi.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <Input label="Nama" placeholder="mis. Budi Gudang" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" autoComplete="off" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Kata sandi awal</span>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="min. 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11 font-mono"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-400" aria-label="Tampilkan kata sandi">
                  {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
              <Button type="button" variant="soft" onClick={() => setPassword(randomPassword())} aria-label="Buat acak">
                <Wand2 className="size-4" /> Acak
              </Button>
            </div>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Peran</span>
            <div className="space-y-2">
              {(['user', 'admin', ...(canSuper ? (['super_admin'] as Role[]) : [])] as Role[]).map((r) => {
                const Icon = ROLE_ICON[r]
                const on = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cx('flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1', on ? 'bg-brand-50 ring-brand-300' : 'ring-ink-100 hover:bg-ink-50')}
                  >
                    <Icon className="mt-0.5 size-5 text-brand-700" />
                    <span className="flex-1">
                      <b className="block text-sm">{ROLE_LABEL[r]}</b>
                      <span className="text-xs text-ink-500">{ROLE_DESC[r]}</span>
                    </span>
                    {on && <Check className="size-5 text-brand-700" />}
                  </button>
                )
              })}
            </div>
          </div>
          <Button block loading={busy} disabled={!name.trim() || !email.trim() || password.length < 6} onClick={submit}>
            <UserPlus className="size-4" /> Buat akun
          </Button>
          <p className="text-xs text-ink-500">Akun langsung aktif tanpa konfirmasi email. Kirim email & kata sandinya ke orang tersebut.</p>
        </div>
      )}
    </Sheet>
  )
}
