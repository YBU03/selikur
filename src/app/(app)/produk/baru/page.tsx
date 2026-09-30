'use client'
import { AdminOnly } from '@/components/AppShell'
import ProductEditor from '@/components/ProductEditor'

function PageInner() {
  return <ProductEditor product={null} />
}

export default function Page() {
  return (
    <AdminOnly>
      <PageInner />
    </AdminOnly>
  )
}
