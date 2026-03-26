import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import { AppProvider } from './state/context'
import App from './App.tsx'

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
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
