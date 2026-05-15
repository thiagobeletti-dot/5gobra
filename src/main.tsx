import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMetaPixel } from './lib/meta-pixel.ts'

// Inicializa Meta Pixel se VITE_META_PIXEL_ID estiver setado.
// Em dev sem ID, vira no-op com console.info.
initMetaPixel()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
