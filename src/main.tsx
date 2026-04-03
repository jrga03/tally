import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import { registerSW } from 'virtual:pwa-register'
import { AppProvider } from './state/context'
import App from './App.tsx'

registerSW({
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
      }, 60 * 60 * 1000) // check for updates every hour
    }
  },
})

const theme = createTheme({
  components: {
    Checkbox: {
      styles: () => ({
        input: {
          borderWidth: 2,
        },
      }),
    },
    TextInput: {
      styles: () => ({
        input: { fontSize: 16 },
      }),
    },
    NumberInput: {
      styles: () => ({
        input: { fontSize: 16 },
      }),
    },
    Select: {
      styles: () => ({
        input: { fontSize: 16 },
      }),
    },
    DatePickerInput: {
      styles: () => ({
        input: { fontSize: 16 },
      }),
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <Notifications position="top-center" />
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
