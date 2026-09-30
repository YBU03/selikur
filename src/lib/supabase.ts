import { createClient } from '@supabase/supabase-js'

// Kunci publishable aman di sisi klien; data dilindungi RLS per pemilik.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bgolhtrduzczjclylegc.supabase.co'
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WwohgMKocFeA3Xv6hzdfYg_uGxA2tBS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export const PHOTO_BUCKET = 'photos'

export function photoUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path
  return `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
}

export async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Sesi berakhir, silakan masuk lagi')
  return id
}
