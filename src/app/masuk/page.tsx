'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button, Input, Segmented } from '@/components/ui'
import { useToast, errMsg } from '@/components/Toast'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-7.9Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  )
}

export default function MasukPage() {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [store, setStore] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && router.replace('/'))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && router.replace('/'))
    return () => data.subscription.unsubscribe()
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'masuk') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { store_name: store || 'Toko Saya' }, emailRedirectTo: `${location.origin}/` },
        })
        if (error) throw error
        if (!data.session) setSent(true)
      }
    } catch (err) {
      const m = errMsg(err)
      toast(/Invalid login/i.test(m) ? 'Email atau kata sandi salah' : /not confirmed/i.test(m) ? 'Email belum dikonfirmasi, cek kotak masuk' : m, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/` } })
    if (error) toast(/not enabled/i.test(error.message) ? 'Login Google belum diaktifkan di Supabase' : error.message, 'error')
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-brand-900 via-brand-800 to-brand-700">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-leaf-500/25 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-24 size-64 rounded-full bg-sun-500/20 blur-3xl" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),3rem)]">
        <div className="flex flex-col items-center text-center text-white">
          <div className="rounded-[1.75rem] bg-white p-2.5 shadow-lift">
            <Image src="/logo-mark.png" alt="Selikur" width={72} height={72} className="rounded-2xl" priority />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Selikur</h1>
          <p className="mt-1.5 max-w-xs text-brand-100">Kulakan pakai data, bukan tebakan. Forecast stok, daftar belanja, dan rekap modal dalam satu aplikasi.</p>
        </div>

        <div className="mt-8 mb-8 rounded-[2rem] bg-white p-5 shadow-lift">
          {sent ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Mail className="size-7" />
              </div>
              <p className="text-lg font-bold">Cek email kamu</p>
              <p className="mt-1 text-sm text-ink-500">Kami mengirim tautan konfirmasi ke {email}. Buka tautan itu untuk mulai memakai Selikur.</p>
              <Button variant="soft" className="mt-5" onClick={() => (setSent(false), setMode('masuk'))}>
                Kembali ke Masuk
              </Button>
            </div>
          ) : (
            <>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'masuk', label: 'Masuk' },
                  { value: 'daftar', label: 'Daftar' },
                ]}
              />
              <form onSubmit={submit} className="mt-5 space-y-3.5">
                {mode === 'daftar' && (
                  <div className="relative">
                    <Store className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
                    <Input placeholder="Nama toko" value={store} onChange={(e) => setStore(e.target.value)} className="pl-11" />
                  </div>
                )}
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
                  <Input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11" />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-400" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
                    placeholder="Kata sandi (min. 6 karakter)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11"
                  />
                </div>
                <Button type="submit" block loading={loading}>
                  {mode === 'masuk' ? 'Masuk' : 'Buat Akun'}
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
                <div className="h-px flex-1 bg-ink-100" /> atau <div className="h-px flex-1 bg-ink-100" />
              </div>
              <Button variant="outline" block onClick={google}>
                <GoogleIcon /> Lanjut dengan Google
              </Button>
            </>
          )}
        </div>
        <p className="mt-auto pb-8 text-center text-xs text-brand-200/80">Data harga modal hanya bisa dilihat oleh kamu.</p>
      </div>
    </div>
  )
}
