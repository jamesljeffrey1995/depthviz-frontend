import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '16px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-bright, #2a251e)',
        }}>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '0.2em' }}>
            SOMETHING WENT WRONG
          </div>
          <div style={{ fontSize: '14px', opacity: 0.6 }}>
            An unexpected error occurred
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: 'var(--accent, #a83b0c)',
              color: 'var(--paper, #f2ecdd)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: '16px',
              letterSpacing: '0.1em',
            }}
          >
            RELOAD
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
