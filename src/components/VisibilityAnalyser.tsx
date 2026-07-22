import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyseVideo,
  subscribeOpenCVLog,
  type CvLogEntry,
  type VisibilityReport,
} from '../lib/underwaterVisibility'
import styles from './VisibilityAnalyser.module.css'

interface Props {
  calib?: number
  onResult?: (report: VisibilityReport) => void
  className?: string
}

type Phase = 'idle' | 'extracting' | 'analysing' | 'done' | 'error'

// ── Sparkbar colour: red→yellow→green by visibility ──
// Module-scope pure function so it isn't reallocated on every render.
function barColor(vis: number, max: number): string {
  const t = Math.min(vis / Math.max(max, 1), 1)
  if (t < 0.5) {
    const r = 220
    const g = Math.round(80 + t * 2 * 140)
    return `rgb(${r},${g},50)`
  }
  const r = Math.round(220 - (t - 0.5) * 2 * 180)
  const g = 200
  return `rgb(${r},${g},60)`
}

// A dive clip can be thousands of frames; rendering one DOM node each makes the
// sparkline enormous. Cap the drawn bars and evenly downsample past this.
const MAX_SPARK_BARS = 240

export default function VisibilityAnalyser({ calib = 4.0, onResult, className }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [report, setReport] = useState<VisibilityReport | null>(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [cvLog, setCvLog] = useState<CvLogEntry[]>([])
  const [showLog, setShowLog] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return subscribeOpenCVLog((entry) => {
      setCvLog((prev) => {
        const next = [...prev, entry]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    })
  }, [])

  const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file.')
        setPhase('error')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`Video must be under 500 MB (yours is ${(file.size / 1024 / 1024).toFixed(0)} MB).`)
        setPhase('error')
        return
      }

      setPhase('extracting')
      setProgress({ current: 0, total: 0 })
      setError('')
      setReport(null)
      setLastFile(file)

      try {
        const result = await analyseVideo(file, {
          calib,
          onProgress: (p, cur, total) => {
            setPhase(p)
            setProgress({ current: cur, total })
          },
        })
        setReport(result)
        setPhase('done')
        onResult?.(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
        setPhase('error')
      }
    },
    [calib, onResult]
  )

  const retry = useCallback(() => {
    if (lastFile) handleFile(lastFile)
  }, [lastFile, handleFile])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const reset = () => {
    setPhase('idle')
    setReport(null)
    setError('')
    setProgress({ current: 0, total: 0 })
    if (inputRef.current) inputRef.current.value = ''
  }

  const downloadCSV = () => {
    if (!report) return
    const header = 'frame,t_median,t_mean,t_p10,t_p90,visibility_m\n'
    const rows = report.frames
      .map(
        (f) =>
          `${f.index},${f.t_median.toFixed(4)},${f.t_mean.toFixed(4)},${f.t_p10.toFixed(4)},${f.t_p90.toFixed(4)},${f.visibility_m.toFixed(2)}`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'depthviz-visibility.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isProcessing = phase === 'extracting' || phase === 'analysing'

  // Evenly downsample the per-frame series to at most MAX_SPARK_BARS so the
  // sparkline DOM stays bounded regardless of clip length.
  const sparkFrames = useMemo(() => {
    const frames = report?.frames
    if (!frames) return []
    if (frames.length <= MAX_SPARK_BARS) return frames
    const step = frames.length / MAX_SPARK_BARS
    const out: typeof frames = []
    for (let i = 0; i < MAX_SPARK_BARS; i++) {
      const f = frames[Math.floor(i * step)]
      if (f) out.push(f)
    }
    return out
  }, [report])

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      {/* ── Upload zone ── */}
      {phase === 'idle' || phase === 'error' ? (
        <>
          <div
            className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className={styles.dropzoneIcon} aria-hidden="true">🎥</div>
            <div className={styles.dropzoneTitle}>Drop dive video here</div>
            <div className={styles.dropzoneHint}>or click to browse — MP4, MOV, WebM</div>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className={styles.hiddenInput}
              onChange={onFileChange}
            />
          </div>
          {error && (
            <>
              <p
                style={{
                  color: 'var(--ds-danger)',
                  fontSize: '0.8rem',
                  marginTop: '0.75rem',
                  textAlign: 'center',
                }}
              >
                {error}
              </p>
              {lastFile && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ flex: 'none', padding: '0.4rem 1rem' }}
                    onClick={retry}
                  >
                    Retry
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {/* ── Progress bar ── */}
      {isProcessing && (
        <div className={styles.progressSection}>
          <div className={styles.phaseLabel}>
            {phase === 'extracting' ? 'Extracting frames…' : 'Analysing visibility…'}
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
          <div className={styles.progressCount}>
            {progress.current} / {progress.total}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'done' && report && (
        <div className={styles.results}>
          {/* Headline */}
          <div className={styles.headline}>
            <span className={styles.headlineValue}>{report.visibility_m.median.toFixed(1)}</span>
            <span className={styles.headlineUnit}>m</span>
            <div className={styles.headlineLabel}>Median Visibility</div>
          </div>

          {/* Validation banner */}
          {report.validation && (
            <div
              className={styles.validationBanner}
              style={{
                borderColor: report.validation.confidence >= 0.7
                  ? 'rgba(15, 179, 122, 0.4)'
                  : report.validation.confidence >= 0.3
                    ? 'rgba(212, 133, 10, 0.4)'
                    : 'rgba(192, 57, 43, 0.4)',
                background: report.validation.confidence >= 0.7
                  ? 'rgba(15, 179, 122, 0.08)'
                  : report.validation.confidence >= 0.3
                    ? 'rgba(212, 133, 10, 0.08)'
                    : 'rgba(192, 57, 43, 0.08)',
              }}
            >
              <div className={styles.validationScore}>
                <span style={{
                  color: report.validation.confidence >= 0.7
                    ? 'var(--ds-success)'
                    : report.validation.confidence >= 0.3
                      ? 'var(--ds-warn)'
                      : 'var(--ds-danger)',
                }}>
                  {report.validation.confidence >= 0.7
                    ? 'Underwater footage confirmed'
                    : report.validation.confidence >= 0.3
                      ? 'Footage may not be underwater'
                      : 'Video does not appear to be underwater'}
                </span>
                <span className={styles.confidenceValue}>
                  {Math.round(report.validation.confidence * 100)}% confidence
                </span>
              </div>
              {report.validation.warnings.length > 0 && (
                <ul className={styles.warningList}>
                  {report.validation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Stat grid */}
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{report.visibility_m.mean.toFixed(1)}</div>
              <div className={styles.statLabel}>Mean</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{report.visibility_m.p10.toFixed(1)}</div>
              <div className={styles.statLabel}>P10</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{report.visibility_m.p90.toFixed(1)}</div>
              <div className={styles.statLabel}>P90</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{report.t_median.toFixed(3)}</div>
              <div className={styles.statLabel}>t̃</div>
            </div>
          </div>

          {/* Sparkbar */}
          <div className={styles.sparkSection}>
            <div className={styles.sparkTitle}>Per-frame visibility</div>
            <div className={styles.sparkContainer}>
              {sparkFrames.map((f) => {
                const maxVis = report.visibility_m.max
                const heightPct = maxVis > 0 ? (f.visibility_m / maxVis) * 100 : 0
                return (
                  <div
                    key={f.index}
                    className={styles.sparkBar}
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      background: barColor(f.visibility_m, maxVis),
                    }}
                    title={`Frame ${f.index}: ${f.visibility_m.toFixed(1)} m`}
                  />
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={downloadCSV}>
              Download CSV
            </button>
            <button className={styles.btnSecondary} onClick={reset}>
              Analyse another
            </button>
          </div>
        </div>
      )}

      {/* Privacy */}
      <div className={styles.privacy}>
        Running entirely on your device — no video is uploaded
      </div>

      {/* ── OpenCV loader debug panel ── */}
      {cvLog.length > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '0.72rem',
            color: 'rgba(180, 200, 215, 0.7)',
          }}
        >
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(120, 180, 210, 0.3)',
              color: 'inherit',
              padding: '0.3rem 0.7rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {showLog ? 'Hide' : 'Show'} video analyser logs ({cvLog.length})
          </button>
          {showLog && (
            <pre
              style={{
                marginTop: '0.5rem',
                padding: '0.6rem',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(120, 180, 210, 0.2)',
                borderRadius: '6px',
                maxHeight: '14rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.68rem',
                lineHeight: 1.4,
                color: 'rgba(210, 225, 235, 0.85)',
              }}
            >
              {cvLog
                .map(
                  (e) =>
                    `[${(e.t / 1000).toFixed(1)}s] ${e.level === 'warn' ? '⚠ ' : ''}${e.message}`
                )
                .join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
