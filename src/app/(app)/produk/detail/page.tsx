'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCatalog } from '@/lib/queries'
import ProductEditor from '@/components/ProductEditor'
import { EmptyState, Loading, PageHeader } from '@/components/ui'

function Detail() {
  const id = useSearchParams().get('id')
  const { data, isPending } = useCatalog()
  const product = data?.find((p) => p.id === id)
  if (isPending) return <Loading />
  if (!product)
    return (
      <>
        <PageHeader title="Produk" back="/produk" />
        <EmptyState title="Produk tidak ditemukan" text="Mungkin sudah dihapus." />
      </>
    )
  return <ProductEditor key={product.id} product={product} />
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Detail />
    </Suspense>
  )
}
