import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './index.css'

// Clickjacking defense: break out of frames
try {
  if (window.self !== window.top) {
    window.top!.location.href = window.self.location.href
  }
} catch {
  // Cross-origin frame detected — rely on server-side X-Frame-Options / CSP headers
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
