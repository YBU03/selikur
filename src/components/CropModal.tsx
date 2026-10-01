'use client'
import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { RotateCcw, RotateCw } from 'lucide-react'
import { cropToBlob } from '@/lib/photos'
import { Button, Segmented } from './ui'

type Aspect = 'asli' | '1' | '3/4' | '4/5' | '4/3'

export default function CropModal({ src, onDone, onCancel }: { src: string; onDone: (b: Blob) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState<Aspect>('asli')
  const [natural, setNatural] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  // Foto diputar 90°/270° → rasio "asli" ikut berbalik (vertikal ↔ horizontal).
  const sideways = Math.abs(rotation % 180) === 90
  const ratio = { asli: sideways ? 1 / natural : natural, '1': 1, '3/4': 3 / 4, '4/5': 4 / 5, '4/3': 4 / 3 }[aspect]
  const turn = (d: number) => setRotation((r) => (r + d) % 360)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-900">
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={ratio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onMediaLoaded={(m) => setNatural(m.naturalWidth / m.naturalHeight)}
          onCropComplete={(_, px) => setArea(px)}
        />
      </div>
      <div className="space-y-3 bg-ink-900 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => turn(-90)} aria-label="Putar ke kiri" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20">
            <RotateCcw className="size-5" />
          </button>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="w-full accent-sun-500" />
          <button type="button" onClick={() => turn(90)} aria-label="Putar ke kanan" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20">
            <RotateCw className="size-5" />
          </button>
        </div>
        <Segmented
          value={aspect}
          onChange={setAspect}
          className="bg-white/10"
          options={[
            { value: 'asli', label: 'Asli' },
            { value: '1', label: '1:1' },
            { value: '3/4', label: '3:4' },
            { value: '4/5', label: '4:5' },
            { value: '4/3', label: '4:3' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} className="!border-white/25 !bg-transparent !text-white hover:!bg-white/10">
            Batal
          </Button>
          <Button
            variant="accent"
            loading={busy}
            onClick={async () => {
              if (!area) return
              setBusy(true)
              try {
                onDone(await cropToBlob(src, area, rotation))
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
