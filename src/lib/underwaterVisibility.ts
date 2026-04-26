import { extractFramesViaWebCodecs, webCodecsSupported } from './webcodecsFrameExtractor'

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
    _worker.addEventListener('error', () => {
      // Worker crashed — discard so next call creates a fresh one.
      _worker = null
    })
    // Log forwarding happens in analyseVideo's per-call message handler.
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
  /** Delay in ms between iOS retry attempts to let the media pipeline reset. */
  const IOS_RETRY_DELAY_MS = 500

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

  /** Create a hidden video element with the correct attributes for iOS Safari. */
  const makeVideoEl = (): HTMLVideoElement => {
    const v = document.createElement('video')
    v.muted = true
    // Do NOT set autoplay — on iOS Safari it can fire an immediate
    // SRC_NOT_SUPPORTED (code 4) on large blob URLs before the container
    // has been parsed.  Frame extraction only needs loadedmetadata + seeking.
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    v.preload = 'auto'
    // iOS Safari requires the element to be in the DOM to load media.
    v.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none'
    document.body.appendChild(v)
    return v
  }

  let video = makeVideoEl()

  emit('info', `file: ${file.name} type=${file.type || '(empty)'} blobMime=${mime} size=${(file.size / 1e6).toFixed(1)}MB`)
  emit('info', `canPlayType: mp4=${video.canPlayType('video/mp4')} qt=${video.canPlayType('video/quicktime')} declared=${video.canPlayType(file.type || mime)}`)

  /** Remove video element and release its blob URL. */
  const cleanup = () => {
    if (video.parentNode) document.body.removeChild(video)
    URL.revokeObjectURL(url)
  }

  /** Try loading a given source URL into the video element. */
  const tryLoad = (src: string): Promise<void> => {
    // Reset element state to clear any lingering error from a previous attempt.
    // Do NOT call video.load() after removing src — on iOS Safari this queues a
    // stale error event (from the "no source" state) that is not properly
    // discarded by the subsequent load() call with the new src.  The stale error
    // fires after the new listeners are attached, causing retries to fail
    // instantly before the real source has a chance to load.
    video.pause()
    video.removeAttribute('src')

    return new Promise<void>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      // Use named handlers so they can be explicitly removed in `done`, preventing
      // stale listeners from accumulating across multiple tryLoad calls.
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        if (timer !== undefined) clearTimeout(timer)
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('loadeddata', onLoaded)
        video.removeEventListener('canplay', onLoaded)
        video.removeEventListener('error', onError)
        if (err) reject(err)
        else resolve()
      }

      const onLoaded = () => done()
      const onError = () => {
        const e = video.error
        const CODES: Record<number, string> = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' }
        done(new Error(`Failed to load video: ${CODES[e?.code ?? 0] ?? 'UNKNOWN'} (code ${e?.code ?? '?'}) — ${e?.message || 'no message'}`))
      }

      timer = setTimeout(() => done(new Error('Video load timed out after 30 s')), 30_000)

      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('loadeddata', onLoaded)
      video.addEventListener('canplay', onLoaded)
      video.addEventListener('error', onError)

      video.src = src
      video.load()
    })
  }

  // Attempt to load; if it fails, retry with alternate MIME types and, as a last
  // resort, a direct File-backed blob URL (skips the ArrayBuffer copy).
  try {
    await tryLoad(url)
  } catch (firstErr) {
    const isSrcNotSupported = video.error?.code === 4
    // On iOS, retrying the same ArrayBuffer blob data with a different MIME label
    // (e.g. video/quicktime) almost never helps when video/mp4 already failed —
    // the error is typically codec/access-related, not MIME-related.  Skip the
    // MIME fallbacks on iOS and go straight to the direct File URL, which uses a
    // fundamentally different access path that works for Files-app sources.
    const fallbacks = (isIOS ? [] : [file.type, 'video/quicktime', 'video/mp4'])
      .filter((m, i, a) => m && m !== mime && a.indexOf(m) === i) as string[]

    let succeeded = false

    // ── 1. Retry with alternate MIME types (blob from ArrayBuffer) ──
    if (isSrcNotSupported && fallbacks.length > 0) {
      for (const retryMime of fallbacks) {
        emit('warn', `load failed (${mime}), retrying as ${retryMime}`)
        URL.revokeObjectURL(url)
        try {
          if (!buffer) buffer = await file.arrayBuffer()
          const fb = new Blob([buffer], { type: retryMime })
          url = URL.createObjectURL(fb)
          await tryLoad(url)
          emit('info', `loaded successfully with MIME ${retryMime}`)
          succeeded = true
          break
        } catch (e) {
          emit('warn', `MIME fallback ${retryMime} failed: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    // ── 2. Last resort: direct File URL (skips ArrayBuffer copy). ──
    // On iOS, File-backed URLs sometimes work for files opened from the
    // Files app even when manually-created blobs do not.
    if (!succeeded) {
      emit('warn', 'blob URL approaches failed — trying direct file URL')
      URL.revokeObjectURL(url)
      if (isIOS) await new Promise(r => setTimeout(r, IOS_RETRY_DELAY_MS))
      try {
        url = URL.createObjectURL(file)
        await tryLoad(url)
        emit('info', 'loaded successfully via direct file URL')
        succeeded = true
      } catch (e) {
        emit('warn', `direct file URL failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    /** Replace the current video element with a brand-new one and revoke the
     *  stale blob URL.  Returns after the iOS media pipeline settle delay. */
    const resetWithFreshElement = async () => {
      if (video.parentNode) document.body.removeChild(video)
      video = makeVideoEl()
      URL.revokeObjectURL(url)
      await new Promise(r => setTimeout(r, IOS_RETRY_DELAY_MS))
    }

    // ── 3. iOS nuclear option: brand-new video element + direct File URL ──
    // If the same <video> element could not load any source, its internal
    // state may be poisoned.  Creating a completely fresh element avoids
    // any stale decoder / error state that iOS Safari may retain.
    if (!succeeded && isIOS) {
      emit('warn', 'retrying with a fresh <video> element')
      await resetWithFreshElement()
      try {
        url = URL.createObjectURL(file)
        await tryLoad(url)
        emit('info', 'loaded successfully with fresh element + direct file URL')
        succeeded = true
      } catch (e) {
        emit('warn', `fresh element also failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    // ── 4. iOS: fresh element + ArrayBuffer blob URL with original MIME ──
    // Some iOS sources (e.g. Photos library) need the ArrayBuffer copy but
    // fail on a reused element.  Try the ArrayBuffer approach again on a
    // clean element.
    if (!succeeded && isIOS) {
      emit('warn', 'retrying with fresh element + ArrayBuffer blob')
      await resetWithFreshElement()
      try {
        if (!buffer) buffer = await file.arrayBuffer()
        const blob = new Blob([buffer], { type: mime })
        url = URL.createObjectURL(blob)
        await tryLoad(url)
        emit('info', 'loaded successfully with fresh element + ArrayBuffer blob')
        succeeded = true
      } catch (e) {
        emit('warn', `fresh element + ArrayBuffer blob also failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    if (!succeeded) {
      cleanup()

      // ── 5. WebCodecs fallback (iOS 16.4+ / modern browsers). ──
      // Every `<video>` element path failed with the same error — usually a
      // container or codec iOS Safari refuses to play from blob URLs (HEVC
      // 10-bit from Photos, MP4 with moov at end, etc.). Demux with mp4box
      // and decode with WebCodecs directly; this skips the <video> pipeline.
      if (isIOS && webCodecsSupported()) {
        emit('warn', 'all <video> approaches failed — trying WebCodecs decoder')
        try {
          return await extractFramesViaWebCodecs(file, {
            maxFrames,
            onProgress: opts.onProgress,
            log: (level, message) => emit(level, `[webcodecs] ${message}`),
          })
        } catch (wcErr) {
          emit('warn', `WebCodecs fallback failed: ${wcErr instanceof Error ? wcErr.message : wcErr}`)
        }
      } else if (isIOS) {
        emit('warn', 'WebCodecs unavailable on this iOS build — no further fallbacks')
      }

      if (isIOS) {
        throw new Error(
          'Could not decode this video on your iOS device. ' +
          'Open the Photos app, share the clip to Files, and choose "Most Compatible" — ' +
          'this re-exports it as H.264 MP4, which iOS Safari can always play. ' +
          'Alternatively, update to iOS 16.4 or newer.',
        )
      }
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

  // Cap output resolution so a 4K clip doesn't flood the worker with ~2 GB of
  // RGBA data (see note in webcodecsFrameExtractor.ts).
  const ANALYSIS_MAX_DIM = 1280
  const srcW = video.videoWidth
  const srcH = video.videoHeight
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(srcW, srcH))
  const outW = Math.max(1, Math.round(srcW * scale))
  const outH = Math.max(1, Math.round(srcH * scale))
  if (scale < 1) {
    emit('info', `downscaling frames ${srcW}×${srcH} → ${outW}×${outH} to fit worker memory`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!

  const frames: ImageData[] = []
  for (let i = 0; i < frameCount; i++) {
    const seekTime = interval * (i + 1)
    await seekTo(video, Math.min(seekTime, duration - 0.05))
    ctx.drawImage(video, 0, 0, outW, outH)
    frames.push(ctx.getImageData(0, 0, outW, outH))
    opts.onProgress?.(i + 1, frameCount)
  }

  cleanup()
  return frames
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      reject(new Error(`Seek to ${time.toFixed(2)}s timed out after 10 s`))
    }, 10_000)

    video.addEventListener('seeked', function onSeeked() {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeEventListener('seeked', onSeeked)
      resolve()
    })
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
    // Inactivity timeout: reset whenever the worker sends a log or progress
    // message, so a slow-but-alive analysis isn't killed spuriously. The
    // initial window covers WASM instantiation before any message arrives.
    const TIMEOUT_MS = 60_000
    let timer: ReturnType<typeof setTimeout>
    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        cleanup()
        reject(new Error('Analysis stalled — no worker activity for 60 s'))
      }, TIMEOUT_MS)
    }
    resetTimer()

    function cleanup() {
      clearTimeout(timer)
      worker.removeEventListener('message', onMsg)
      worker.removeEventListener('error', onErr)
    }

    const onMsg = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'log') {
        resetTimer()
        emit(msg.level, msg.message)
      } else if (msg.type === 'progress') {
        resetTimer()
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
