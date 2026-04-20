// ── Types ────────────────────────────────────────────────────────────────────

export interface FrameResult {
  index: number
  t_median: number
  t_mean: number
  t_p10: number
  t_p90: number
  visibility_m: number
}

export interface VisibilityStats {
  median: number
  mean: number
  p10: number
  p90: number
  min: number
  max: number
}

export interface VideoValidation {
  confidence: number       // 0.0–1.0
  warnings: string[]
  is_valid: boolean
}

export interface VisibilityReport {
  visibility_m: VisibilityStats
  t_median: number
  frames: FrameResult[]
  frameCount: number
  calib: number
  validation?: VideoValidation
}

export interface AnalyseOptions {
  calib?: number
  downsample?: number
  maxFrames?: number
  onProgress?: (phase: 'extracting' | 'analysing', current: number, total: number) => void
}

// ── Log stream ───────────────────────────────────────────────────────────────

export type CvLogLevel = 'info' | 'warn'
export interface CvLogEntry { t: number; level: CvLogLevel; message: string }

const cvLogBuffer: CvLogEntry[] = []
const cvLogListeners = new Set<(entry: CvLogEntry) => void>()
const loaderStart = () => {
  const w = window as unknown as Record<string, unknown>
  if (!w.__cvLoaderStart) w.__cvLoaderStart = performance.now()
  return w.__cvLoaderStart as number
}

export function subscribeOpenCVLog(fn: (entry: CvLogEntry) => void): () => void {
  cvLogListeners.add(fn)
  for (const entry of cvLogBuffer) fn(entry)
  return () => { cvLogListeners.delete(fn) }
}

export function getOpenCVLog(): CvLogEntry[] {
  return [...cvLogBuffer]
}

function emit(level: CvLogLevel, message: string) {
  const entry: CvLogEntry = { t: performance.now() - loaderStart(), level, message }
  cvLogBuffer.push(entry)
  if (cvLogBuffer.length > 200) cvLogBuffer.shift()
  for (const fn of cvLogListeners) {
    try { fn(entry) } catch { /* ignore */ }
  }
  if (level === 'warn') console.warn('[OpenCV]', message)
  else console.info('[OpenCV]', message)
}

// ── Worker singleton ─────────────────────────────────────────────────────────

let _worker: Worker | null = null

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/opencv.worker.ts', import.meta.url), { type: 'module' })
    _worker.addEventListener('message', (e) => {
      // Forward worker log entries into the shared log stream.
      if (e.data?.type === 'log') emit(e.data.level, e.data.message)
    })
    _worker.addEventListener('error', () => {
      // Worker crashed — discard so next call creates a fresh one.
      _worker = null
    })
  }
  return _worker
}

// ── MIME helpers ──────────────────────────────────────────────────────────────

/** Map container MIME types that browsers may reject from blob URLs to ones they
 *  reliably accept.  QuickTime (.mov) and MP4 share the same ISO-BMFF container,
 *  so `video/mp4` works for both. */
function blobMime(file: File): string {
  const t = file.type.toLowerCase()
  if (t === 'video/quicktime') return 'video/mp4'
  if (t) return t
  // file.type can be empty on some mobile browsers — infer from extension.
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'mov' || ext === 'mp4' || ext === 'm4v') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  return 'video/mp4' // safe default
}

// ── Frame extraction (needs DOM — stays on main thread) ──────────────────────

export async function extractFrames(
  file: File,
  opts: { maxFrames?: number; onProgress?: (current: number, total: number) => void } = {},
): Promise<ImageData[]> {
  const maxFrames = opts.maxFrames ?? 60

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const mime = blobMime(file)

  // Build a blob URL the video element can consume.
  // On iOS, File objects from the picker are backed by the system photo-library
  // file handle. createObjectURL(File) produces a blob URL that the video element
  // cannot access (code 4: SRC_NOT_SUPPORTED). Reading the data into an
  // ArrayBuffer first copies it into normal memory, making the blob URL reliable.
  // We also normalise the MIME type (e.g. video/quicktime → video/mp4) because
  // many browsers refuse to play blob URLs declared as video/quicktime.
  let url: string
  let buffer: ArrayBuffer | null = null
  if (isIOS) {
    emit('info', 'iOS detected — reading file into memory before creating blob URL')
    try {
      buffer = await file.arrayBuffer()
      const blob = new Blob([buffer], { type: mime })
      url = URL.createObjectURL(blob)
    } catch (e) {
      emit('warn', `arrayBuffer() failed (${e}), falling back to direct createObjectURL`)
      url = URL.createObjectURL(file)
    }
  } else if (file.type !== mime) {
    // Non-iOS but MIME was normalised — re-wrap so the blob URL carries the
    // corrected type (e.g. .mov files on desktop Chrome/Firefox).
    emit('info', `re-wrapping blob with corrected MIME ${file.type || '(empty)'} → ${mime}`)
    try {
      buffer = await file.arrayBuffer()
      const blob = new Blob([buffer], { type: mime })
      url = URL.createObjectURL(blob)
    } catch {
      url = URL.createObjectURL(file)
    }
  } else {
    url = URL.createObjectURL(file)
  }

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'metadata'
  // iOS Safari requires the element to be in the DOM to load media.
  video.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none'
  document.body.appendChild(video)

  emit('info', `file: ${file.name} type=${file.type || '(empty)'} blobMime=${mime} size=${(file.size / 1e6).toFixed(1)}MB`)
  emit('info', `canPlayType: mp4=${video.canPlayType('video/mp4')} qt=${video.canPlayType('video/quicktime')} declared=${video.canPlayType(file.type || mime)}`)

  /** Remove video element and release its blob URL. */
  const cleanup = () => {
    document.body.removeChild(video)
    URL.revokeObjectURL(url)
  }

  /** Try loading a given source URL into the video element. */
  const tryLoad = (src: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      let settled = false
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        if (err) reject(err)
        else resolve()
      }

      video.addEventListener('loadedmetadata', () => done(), { once: true })
      video.addEventListener('loadeddata', () => done(), { once: true })
      video.addEventListener('error', () => {
        const e = video.error
        const CODES: Record<number, string> = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }
        done(new Error(`Failed to load video: ${CODES[e?.code ?? 0] ?? 'UNKNOWN'} (code ${e?.code ?? '?'}) — ${e?.message || 'no message'}`))
      }, { once: true })

      video.src = src
      video.load()
      // iOS Safari often won't initialise a blob-URL video without a play() attempt,
      // even if play() itself is rejected (no user-gesture context at this point).
      video.play().catch(() => { /* expected — we only need the side-effect */ })
    })

  // Attempt to load; if SRC_NOT_SUPPORTED (code 4), retry with video/mp4 blob.
  try {
    await tryLoad(url)
  } catch (firstErr) {
    const isSrcNotSupported = video.error?.code === 4
    if (isSrcNotSupported && mime !== 'video/mp4') {
      emit('warn', `initial load failed (${mime}), retrying as video/mp4`)
      URL.revokeObjectURL(url)
      try {
        if (!buffer) buffer = await file.arrayBuffer()
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' })
        url = URL.createObjectURL(mp4Blob)
        await tryLoad(url)
      } catch (retryErr) {
        cleanup()
        throw retryErr
      }
    } else {
      cleanup()
      throw firstErr
    }
  }

  const duration = video.duration
  if (!duration || !isFinite(duration)) {
    cleanup()
    throw new Error('Could not determine video duration')
  }

  const frameCount = Math.min(maxFrames, Math.floor(duration * 2))
  const interval = duration / (frameCount + 1)

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!

  const frames: ImageData[] = []
  for (let i = 0; i < frameCount; i++) {
    const seekTime = interval * (i + 1)
    await seekTo(video, Math.min(seekTime, duration - 0.05))
    ctx.drawImage(video, 0, 0)
    frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    opts.onProgress?.(i + 1, frameCount)
  }

  cleanup()
  return frames
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

// ── High-level analyseVideo ───────────────────────────────────────────────────

export async function analyseVideo(
  file: File,
  opts: AnalyseOptions = {},
): Promise<VisibilityReport> {
  const calib = opts.calib ?? 4.0
  const downsample = opts.downsample ?? 0.5
  const maxFrames = opts.maxFrames ?? 60

  // Reset log timer for this run.
  ;(window as unknown as Record<string, unknown>).__cvLoaderStart = performance.now()
  emit('info', `starting analysis — extracting up to ${maxFrames} frames`)

  // Phase 1: extract frames on the main thread (requires DOM video element).
  const imageFrames = await extractFrames(file, {
    maxFrames,
    onProgress: (cur, total) => opts.onProgress?.('extracting', cur, total),
  })

  emit('info', `extracted ${imageFrames.length} frames — sending to worker`)

  // Phase 2: transfer pixel data to the worker so OpenCV runs off-thread.
  const worker = getWorker()

  return new Promise<VisibilityReport>((resolve, reject) => {
    const TIMEOUT_MS = 120_000
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Analysis timed out after 120 s'))
    }, TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      worker.removeEventListener('message', onMsg)
      worker.removeEventListener('error', onErr)
    }

    const onMsg = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'log') {
        emit(msg.level, msg.message)
      } else if (msg.type === 'progress') {
        opts.onProgress?.(msg.phase, msg.current, msg.total)
      } else if (msg.type === 'result') {
        cleanup()
        resolve({ ...msg.report, validation: validateVideoMetrics(msg.report) })
      } else if (msg.type === 'error') {
        cleanup()
        reject(new Error(msg.message))
      }
    }

    const onErr = (e: ErrorEvent) => {
      cleanup()
      _worker = null   // force fresh worker next time
      reject(new Error(`Worker crashed: ${e.message}`))
    }

    worker.addEventListener('message', onMsg)
    worker.addEventListener('error', onErr)

    // Transfer the underlying ArrayBuffers (zero-copy) to the worker.
    const frameData = imageFrames.map(f => ({ buffer: f.data.buffer, width: f.width, height: f.height }))
    const transferables = frameData.map(f => f.buffer)
    worker.postMessage({ type: 'analyse', frames: frameData, calib, downsample }, transferables)
  })
}

// ── Client-side video validation ──────────────────────────────────────────────

export function validateVideoMetrics(report: VisibilityReport): VideoValidation {
  const warnings: string[] = []
  let score = 1.0

  if (report.t_median > 0.92) {
    score -= 0.5
    warnings.push('Transmission too high \u2014 video may not be underwater')
  } else if (report.t_median > 0.85) {
    score -= 0.25
    warnings.push('Transmission is unusually high for underwater footage')
  } else if (report.t_median < 0.03) {
    score -= 0.3
    warnings.push('Transmission extremely low \u2014 possible processing error')
  }

  if (report.visibility_m.median > 40) {
    score -= 0.4
    warnings.push('Visibility unrealistically high \u2014 likely not underwater')
  } else if (report.visibility_m.median > 30) {
    score -= 0.15
    warnings.push('Visibility very high \u2014 verify footage is underwater')
  } else if (report.visibility_m.median < 0.2) {
    score -= 0.2
    warnings.push('Visibility extremely low \u2014 possible error')
  }

  const spread = report.visibility_m.p90 - report.visibility_m.p10
  const relSpread = spread / Math.max(report.visibility_m.median, 0.1)
  if (spread < 0.05 && report.frameCount > 3) {
    score -= 0.25
    warnings.push('Near-zero visibility variance \u2014 may not be real footage')
  }
  if (relSpread > 3.0) {
    score -= 0.2
    warnings.push('High variance \u2014 footage may contain non-underwater segments')
  }

  if (report.frameCount < 3) {
    score -= 0.15
    warnings.push('Very few frames analysed \u2014 results may be unreliable')
  }

  const confidence = Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
  return { confidence, warnings, is_valid: confidence >= 0.3 }
}
