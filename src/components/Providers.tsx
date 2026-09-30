'use client'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del, createStore } from 'idb-keyval'
import { flush, setAfterFlush } from '@/lib/outbox'
import { ToastProvider } from './Toast'

const DAY = 24 * 60 * 60 * 1000

function makePersister() {
  if (typeof indexedDB === 'undefined') return undefined
  const store = createStore('selikur-cache', 'kv')
  return createAsyncStoragePersister({
    storage: {
      getItem: (k) => get(k, store),
      setItem: (k, v) => set(k, v, store),
      removeItem: (k) => del(k, store),
    },
    throttleTime: 3000,
  })
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: 'offlineFirst',
            gcTime: 7 * DAY,
            staleTime: 2 * 60 * 1000,
            retry: (n, err) => n < 2 && !String((err as Error)?.message).includes('JWT'),
            refetchOnWindowFocus: true,
          },
          mutations: { networkMode: 'offlineFirst' },
        },
      }),
  )
  const [persister] = useState(makePersister)

  useEffect(() => {
    setAfterFlush(() => client.invalidateQueries())
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    void flush()
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    return () => window.removeEventListener('online', onOnline)
  }, [client])

  const content = <ToastProvider>{children}</ToastProvider>
  if (!persister) return <QueryClientProvider client={client}>{content}</QueryClientProvider>
  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: 7 * DAY, buster: 'v1' }}>
      {content}
    </PersistQueryClientProvider>
  )
}
