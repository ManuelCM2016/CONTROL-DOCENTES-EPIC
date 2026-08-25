import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Registro del Service Worker (PWA Offline) ──
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('🚀 [PWA] Service Worker registrado exitosamente con scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('⚠️ [PWA] Error al registrar Service Worker:', err)
      })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

