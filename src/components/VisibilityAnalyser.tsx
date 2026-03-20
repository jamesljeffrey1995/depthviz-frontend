import { useCallback, useRef, useState } from 'react'
import { analyseVideo, type VisibilityReport } from '../lib/underwaterVisibility'
import styles from './VisibilityAnalyser.module.css'

interface Props {
  calib?: number
  onResult?: (report: VisibilityReport) => void
  className?: string
}

type Phase = 'idle' | 'extracting' | 'analysing' | 'done' | 'error'

export default function VisibilityAnalyser({ calib = 4.0, onResult, className }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [report, setReport] = useState<VisibilityReport | null>(null)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file.')
        setPhase('error')
        return
      }

      setPhase('extracting')
      setProgress({ current: 0, total: 0 })
      setError('')
      setReport(null)

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

  // ── Sparkbar colour: red→yellow→green by visibility ──
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

  const isProcessing = phase === 'extracting' || phase === 'analysing'

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
            <div className={styles.dropzoneIcon}>🎥</div>
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
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'center' }}>
              {error}
            </p>
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
              {report.frames.map((f) => {
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
    </div>
  )
}
