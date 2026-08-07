import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { trackClientEvent } from '../lib/telemetry'

interface Props {
  children: ReactNode
  path?: string
  onRecover?: (target: 'retry' | 'home') => void
  onError?: (error: Error, info: ErrorInfo) => void
  resetKey?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackClientEvent('ui.render_crash', {
      message: error.message,
      stack: error.stack ?? null,
      path: this.props.path ?? null,
    })
    this.props.onError?.(error, info)
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
          color: 'var(--text-bright, #101820)',
        }}>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-display, sans-serif)', letterSpacing: '0.2em' }}>
            SOMETHING WENT WRONG
          </div>
          <div style={{ fontSize: '14px', opacity: 0.6, textAlign: 'center', maxWidth: 420 }}>
            An unexpected error occurred
            {this.props.path ? ` on ${this.props.path}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                this.props.onRecover?.('retry')
                window.location.reload()
              }}
              style={{
                padding: '10px 24px',
                background: 'var(--accent, #0e7c86)',
                color: 'var(--face, #0b1622)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '16px',
                letterSpacing: '0.1em',
              }}
            >
              RELOAD
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                this.props.onRecover?.('home')
              }}
              style={{
                padding: '10px 24px',
                background: 'transparent',
                color: 'var(--text-bright, #101820)',
                border: '1px solid currentColor',
                cursor: 'pointer',
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: '16px',
                letterSpacing: '0.1em',
              }}
            >
              GO HOME
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
