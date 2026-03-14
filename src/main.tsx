import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource/bebas-neue/400.css'
import './index.css'

// Clickjacking defense: break out of frames
if (window.self !== window.top) {
  window.top!.location.href = window.self.location.href
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
