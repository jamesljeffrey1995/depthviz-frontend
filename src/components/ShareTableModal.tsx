import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { ApneaTable } from '../types'
import { buildShareUrl } from '../lib/shareTable'
import { useDialog } from '../hooks/useDialog'
import { IconClose, IconCheck } from './icons'
import styles from './ShareTableModal.module.css'

interface Props {
  table: ApneaTable
  onClose: () => void
}

/**
 * QR + link sharing for an apnea table. The link carries the table data in
 * the URL fragment, so it works for private tables without making them
 * public, and keeps working even if the original table is edited or deleted.
 */
export function ShareTableModal({ table, onClose }: Props) {
  // ESC-to-close, focus trap, scroll lock and focus restoration.
  const modalRef = useDialog<HTMLDivElement>(onClose)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [copied, setCopied] = useState(false)

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    const url = buildShareUrl(table)
    setShareUrl(url)
    const canvas = canvasRef.current
    if (!canvas) return
    // Dark-on-white with a quiet zone — inverted QR codes scan unreliably,
    // so the code keeps a fixed light background regardless of app theme.
    // "Dark" module color is --ink's resolved value (a literal, not a CSS
    // var — this runs through the qrcode library's canvas API, which needs
    // a real color string, not a custom property).
    QRCode.toCanvas(canvas, url, {
      width: 232,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#101820', light: '#ffffff' },
    }).catch(() => setQrError(true))
  }, [table])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be unavailable (http, permissions) — leave the
      // URL selectable in the input below as the fallback.
      const input = modalRef.current?.querySelector('input')
      input?.select()
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: `${table.name} — DepthViz training table`, url: shareUrl })
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.modal}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close share dialog">
          <IconClose width={16} height={16} />
        </button>

        <div className={styles.title} id="share-modal-title">SHARE TABLE</div>
        <div className={styles.sub}>{table.name}</div>

        <div className={styles.qrWrap}>
          {qrError ? (
            <div className={styles.qrFallback}>QR code unavailable — use the link below</div>
          ) : (
            <canvas ref={canvasRef} className={styles.qrCanvas} aria-label={`QR code linking to the training table ${table.name}`} />
          )}
        </div>

        <div className={styles.hint}>
          Scan with a phone camera to open this table. The link contains the
          full table, so it works even for private tables — anyone with it can
          view, run, and save a copy.
        </div>

        <div className={styles.linkRow}>
          <input
            className={styles.linkInput}
            type="text"
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={e => e.target.select()}
          />
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? (<><IconCheck width={12} height={12} /> Copied</>) : 'Copy'}
          </button>
        </div>

        {canNativeShare && (
          <button className={styles.shareBtn} onClick={handleNativeShare}>
            Share via…
          </button>
        )}
      </div>
    </div>
  )
}
