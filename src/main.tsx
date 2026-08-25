import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { installApiV1Transport } from './lib/apiV1Transport'
import './styles/tokens.css'
import './index.css'

// Install before React renders so every first-party backend request uses the
// canonical /api/v1 namespace and route aliases from the first request onward.
installApiV1Transport()

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
