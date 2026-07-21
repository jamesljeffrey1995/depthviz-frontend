import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/tokens.css'
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
