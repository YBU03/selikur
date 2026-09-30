'use client'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, DownloadCloud } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSuppliers } from '@/lib/queries'
import { Button, Card } from './ui'
import { useToast, errMsg } from './Toast'

/** Impor data kulakan awal dari file "Simulasi Harga Jual Tumbler" (Toko Kembar & Toko OBI). */
export default function StarterImport({ compact }: { compact?: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: suppliers, isPending } = useSuppliers()
  const [busy, setBusy] = useState(false)
  if (isPending || suppliers?.some((s) => s.name === 'Toko Kembar' || s.name === 'Toko OBI')) return null

  async function run() {
    setBusy(true)
    const { data, error } = await supabase.rpc('import_starter_data')
    setBusy(false)
    if (error) return toast(errMsg(error), 'error')
    await qc.invalidateQueries()
    toast(data ? `${data} produk tumbler berhasil diimpor` : 'Data sudah pernah diimpor', data ? 'success' : 'info')
  }

  if (compact)
    return (
      <Button variant="outline" block loading={busy} onClick={run}>
        <DownloadCloud className="size-4.5" /> Impor data kulakan awal (Excel simulasi)
      </Button>
    )
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-sun-50 to-white ring-sun-100">
      <div className="flex gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun-500 text-white shadow-sun">
          <FileSpreadsheet className="size-6" />
        </span>
        <div>
          <p className="font-bold text-ink-900">Impor data kulakan kamu</p>
          <p className="mt-0.5 text-sm text-ink-600">
            Dari file <i>Simulasi Harga Jual Tumbler</i>: Toko Kembar & Toko OBI — 18 produk, 65 varian warna, harga kulak, harga jual, dan stok.
          </p>
        </div>
      </div>
      <Button block className="mt-4" loading={busy} onClick={run}>
        <DownloadCloud className="size-4.5" /> Impor sekarang
      </Button>
    </Card>
  )
}
