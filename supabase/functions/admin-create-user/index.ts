// Membuat akun pengguna baru oleh Admin / Super Admin Selikur.
// Kunci service role hanya ada di server (Edge Function), tidak pernah di aplikasi.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const ROLES = ['super_admin', 'admin', 'user']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. Pastikan pemanggil login dan berperan admin / super admin yang aktif
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Harus masuk dulu' }, 401)
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller.user) return json({ error: 'Sesi tidak valid, silakan masuk lagi' }, 401)
  const { data: me } = await admin.from('profiles').select('role, status').eq('id', caller.user.id).single()
  if (!me || me.status !== 'approved' || !['admin', 'super_admin'].includes(me.role)) {
    return json({ error: 'Hanya admin yang bisa menambah pengguna' }, 403)
  }

  // 2. Validasi isian
  let body: { email?: string; password?: string; full_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Data tidak valid' }, 400)
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const fullName = String(body.full_name ?? '').trim()
  const role = String(body.role ?? 'user')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Format email tidak valid' }, 400)
  if (password.length < 6) return json({ error: 'Kata sandi minimal 6 karakter' }, 400)
  if (!fullName) return json({ error: 'Nama wajib diisi' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Peran tidak valid' }, 400)
  if (role === 'super_admin' && me.role !== 'super_admin') {
    return json({ error: 'Hanya super admin yang bisa membuat super admin' }, 403)
  }

  // 3. Buat akun (langsung terkonfirmasi) lalu setujui dengan peran yang dipilih
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createErr || !created.user) {
    const msg = /already|registered|exists/i.test(createErr?.message ?? '') ? 'Email ini sudah terdaftar' : createErr?.message ?? 'Gagal membuat akun'
    return json({ error: msg }, 400)
  }

  const { error: profErr } = await admin
    .from('profiles')
    .update({ full_name: fullName, role, status: 'approved', approved_by: caller.user.id, approved_at: new Date().toISOString() })
    .eq('id', created.user.id)
  if (profErr) return json({ error: profErr.message }, 500)

  return json({ id: created.user.id, email, role })
})
