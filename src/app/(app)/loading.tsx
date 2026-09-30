import { Skeleton } from '@/components/ui'

/** Tampil seketika saat pindah halaman, sebelum halaman baru siap. */
export default function Loading() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
