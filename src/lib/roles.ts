'use client'
import { useMe } from './queries'

/** Hak akses di UI. Batasan sebenarnya ditegakkan RLS di database. */
export function useRole() {
  const { data: me, isPending } = useMe()
  const role = me?.status === 'approved' ? me.role : null
  return {
    me,
    loading: isPending,
    role,
    isSuper: role === 'super_admin',
    isAdmin: role === 'admin' || role === 'super_admin',
    isUser: role === 'user',
  }
}
