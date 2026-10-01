import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './pico.scss'
import './danger.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './theme/theme'

// Before the first render, so the page never flashes the wrong theme.
applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
