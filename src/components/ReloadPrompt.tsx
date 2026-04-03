import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(async () => {
          if (registration.installing || !navigator) return
          if ('connection' in navigator && !navigator.onLine) return

          try {
            const resp = await fetch(swUrl, {
              cache: 'no-store',
              headers: { 'cache-control': 'no-cache' },
            })
            if (resp?.status === 200) await registration.update()
          } catch {
            // fetch failed (offline, DNS, etc.) — skip this cycle
          }
        }, UPDATE_CHECK_INTERVAL)
      }
    },
  })

  useEffect(() => {
    if (needRefresh) {
      notifications.show({
        id: 'pwa-update',
        title: 'Update available',
        message: 'Tap to reload and get the latest version.',
        autoClose: false,
        withCloseButton: false,
        onClick: () => updateServiceWorker(),
      })
    }
  }, [needRefresh, updateServiceWorker])

  return null
}
