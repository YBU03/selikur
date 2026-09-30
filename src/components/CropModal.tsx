'use client'
import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { cropToBlob } from '@/lib/photos'
import { Button, Segmented } from './ui'

export default function CropModal({ src, onDone, onCancel }: { src: string; onDone: (b: Blob) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState<'1' | '4/5' | '4/3'>('1')
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const ratio = aspect === '1' ? 1 : aspect === '4/5' ? 4 / 5 : 4 / 3
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-900">
      <div className="relative flex-1">
        <Cropper image={src} crop={crop} zoom={zoom} aspect={ratio} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />
      </div>
      <div className="space-y-3 bg-ink-900 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-sun-500" />
        <Segmented
          value={aspect}
          onChange={setAspect}
          className="bg-white/10"
          options={[
            { value: '1', label: '1:1' },
            { value: '4/5', label: '4:5' },
            { value: '4/3', label: '4:3' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} className="border-white/20 bg-transparent text-white hover:bg-white/10">
            Batal
          </Button>
          <Button
            variant="accent"
            loading={busy}
            onClick={async () => {
              if (!area) return
              setBusy(true)
              try {
                onDone(await cropToBlob(src, area))
              } finally {
                setBusy(false)
              }
            }}
          >
            Pakai
          </Button>
        </div>
      </div>
    </div>
  )
}
