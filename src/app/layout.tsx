import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/plus-jakarta-sans'
import './globals.css'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: { default: 'Selikur', template: '%s · Selikur' },
  description: 'Forecast stok, daftar belanja kulakan, jadwal, dan rekap modal untuk penjual online.',
  applicationName: 'Selikur',
  appleWebApp: { capable: true, title: 'Selikur', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/favicon-64.png', sizes: '64x64', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0b5f49',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
