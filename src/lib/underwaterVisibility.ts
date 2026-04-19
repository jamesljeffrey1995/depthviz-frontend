/* eslint-disable @typescript-eslint/no-explicit-any */

// ── OpenCV.js type shim (loaded via CDN <script> in index.html) ─────────────
declare global {
  interface Window {
    cv: any
    Module: any
  }
}

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

// ── OpenCV loader (singleton) ────────────────────────────────────────────────

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js'
const OPENCV_TIMEOUT_MS = 90_000

let cvPromise: Promise<void> | null = null

function injectOpenCVScript() {
  if (typeof document === 'undefined') return
  // Don't inject if a script for this URL already exists — either the
  // static tag in index.html or a previous injection.
  if (document.querySelector(`script[src="${OPENCV_URL}"]`)) return
  const s = document.createElement('script')
  s.src = OPENCV_URL
  s.async = true
  s.setAttribute('data-opencv-loader', 'true')
  document.head.appendChild(s)
}

export function loadOpenCV(): Promise<void> {
  if (cvPromise) return cvPromise

  cvPromise = new Promise<void>((resolve, reject) => {
    // Already loaded & ready
    if (window.cv && window.cv.Mat) {
      resolve()
      return
    }

    // Ensure the script tag is in the DOM (in case index.html tag was removed
    // or loading needs to be retried after a failure).
    injectOpenCVScript()

    const timeout = setTimeout(() => {
      clearInterval(poll)
      // Allow the user to retry by clearing the cached rejected promise.
      cvPromise = null
      reject(new Error(
        `OpenCV.js load timed out after ${OPENCV_TIMEOUT_MS / 1000}s — check your connection and retry`
      ))
    }, OPENCV_TIMEOUT_MS)

    const onReady = () => {
      clearInterval(poll)
      clearTimeout(timeout)
      resolve()
    }

    // If cv exists but WASM not yet ready, hook into it
    if (window.cv) {
      window.cv.onRuntimeInitialized = onReady
    }

    // Polling fallback — the async script may not have loaded yet, and
    // covers the case where onRuntimeInitialized fires before we can attach.
    const poll = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        onReady()
      } else if (window.cv && !window.cv.Mat) {
        window.cv.onRuntimeInitialized = onReady
      }
    }, 200)
  })

  // If the promise rejects, clear the cache so a retry can re-attempt.
  cvPromise.catch(() => {
    cvPromise = null
  })

  return cvPromise
}

// ── Frame extraction from video ──────────────────────────────────────────────

export async function extractFrames(
  file: File,
  opts: { maxFrames?: number; onProgress?: (current: number, total: number) => void } = {}
): Promise<ImageData[]> {
  const maxFrames = opts.maxFrames ?? 60

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    video.src = url
  })

  const duration = video.duration
  if (!duration || !isFinite(duration)) {
    URL.revokeObjectURL(url)
    throw new Error('Could not determine video duration')
  }

  const frameCount = Math.min(maxFrames, Math.floor(duration * 2)) // max 2fps sampling
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

  URL.revokeObjectURL(url)
  return frames
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

// ── Percentile helper ────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ── UnderwaterVisibility (DCP engine) ────────────────────────────────────────

export class UnderwaterVisibility {
  private _ready = false

  async ready(): Promise<void> {
    await loadOpenCV()
    this._ready = true
  }

  analyseFrame(imageData: ImageData, downsample = 0.5): FrameResult & { _tValues: number[] } {
    if (!this._ready) throw new Error('Call ready() before analyseFrame()')
    const cv = window.cv

    let src = cv.matFromImageData(imageData)

    // ── Downsample for performance ──
    if (downsample < 1) {
      const dst = new cv.Mat()
      const dsize = new cv.Size(
        Math.round(src.cols * downsample),
        Math.round(src.rows * downsample)
      )
      cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA)
      src.delete()
      src = dst
    }

    // Convert RGBA → RGB
    const rgb = new cv.Mat()
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
    src.delete()

    // ── Red channel compensation ──
    const channels = new cv.MatVector()
    cv.split(rgb, channels)
    const R = channels.get(0)
    const G = channels.get(1)
    const B = channels.get(2)

    const meanR = cv.mean(R)[0]
    const meanG = cv.mean(G)[0]
    const meanB = cv.mean(B)[0]
    const targetMean = (meanG + meanB) / 2
    const boost = Math.min(targetMean / Math.max(meanR, 1), 3.0)

    if (boost > 1.01) {
      const Rdata = R.data
      for (let i = 0; i < Rdata.length; i++) {
        Rdata[i] = Math.min(255, Math.round(Rdata[i] * boost))
      }
    }

    // Merge back
    const compensated = new cv.Mat()
    cv.merge(channels, compensated)
    R.delete()
    G.delete()
    B.delete()
    channels.delete()
    rgb.delete()

    // ── Normalise to [0,1] float ──
    const floatImg = new cv.Mat()
    compensated.convertTo(floatImg, cv.CV_32FC3, 1.0 / 255.0)
    compensated.delete()

    // ── Dark channel: per-pixel min across channels ──
    const floatChannels = new cv.MatVector()
    cv.split(floatImg, floatChannels)
    const fR = floatChannels.get(0)
    const fG = floatChannels.get(1)
    const fB = floatChannels.get(2)

    const minRG = new cv.Mat()
    cv.min(fR, fG, minRG)
    const darkRaw = new cv.Mat()
    cv.min(minRG, fB, darkRaw)
    minRG.delete()

    // Erosion (min filter) with 15×15 kernel
    const kernelSize = 15
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize))
    const darkChannel = new cv.Mat()
    cv.erode(darkRaw, darkChannel, kernel)
    kernel.delete()
    darkRaw.delete()

    // ── Veiling light A: top 0.1% brightest by dark channel ──
    const dcData = new Float32Array(darkChannel.data32F)
    const numPixels = dcData.length
    const topN = Math.max(1, Math.floor(numPixels * 0.001))

    // Find threshold for top 0.1%
    const dcSorted = Float32Array.from(dcData).sort()
    const dcThreshold = dcSorted[numPixels - topN]

    const fRData = fR.data32F
    const fGData = fG.data32F
    const fBData = fB.data32F

    let sumAR = 0, sumAG = 0, sumAB = 0, countA = 0
    for (let i = 0; i < numPixels; i++) {
      if (dcData[i] >= dcThreshold) {
        sumAR += fRData[i]
        sumAG += fGData[i]
        sumAB += fBData[i]
        countA++
      }
    }
    const A = [
      sumAR / Math.max(countA, 1),
      sumAG / Math.max(countA, 1),
      sumAB / Math.max(countA, 1),
    ]

    // ── Transmission map: t = 1 - 0.95 * darkChannel(I/A) ──
    // Compute I/A per channel, then dark channel of that
    const normR = new cv.Mat()
    const normG = new cv.Mat()
    const normB = new cv.Mat()
    fR.convertTo(normR, cv.CV_32F, 1.0 / Math.max(A[0], 1e-6))
    fG.convertTo(normG, cv.CV_32F, 1.0 / Math.max(A[1], 1e-6))
    fB.convertTo(normB, cv.CV_32F, 1.0 / Math.max(A[2], 1e-6))

    fR.delete()
    fG.delete()
    fB.delete()
    floatChannels.delete()
    floatImg.delete()

    const minNormRG = new cv.Mat()
    cv.min(normR, normG, minNormRG)
    const darkNorm = new cv.Mat()
    cv.min(minNormRG, normB, darkNorm)
    normR.delete()
    normG.delete()
    normB.delete()
    minNormRG.delete()

    const darkNormEroded = new cv.Mat()
    const kernel2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize))
    cv.erode(darkNorm, darkNormEroded, kernel2)
    kernel2.delete()
    darkNorm.delete()

    // t = 1 - 0.95 * darkNormEroded, clamped to [0,1]
    const tData = new Float32Array(darkNormEroded.data32F)
    const tValues: number[] = new Array(tData.length)
    for (let i = 0; i < tData.length; i++) {
      tValues[i] = Math.max(0, Math.min(1, 1 - 0.95 * tData[i]))
    }

    darkNormEroded.delete()
    darkChannel.delete()

    // ── Statistics ──
    tValues.sort((a, b) => a - b)

    const tMedian = percentile(tValues, 50)
    const tMean = tValues.reduce((s, v) => s + v, 0) / tValues.length
    const tP10 = percentile(tValues, 10)
    const tP90 = percentile(tValues, 90)

    return {
      index: 0,
      t_median: tMedian,
      t_mean: tMean,
      t_p10: tP10,
      t_p90: tP90,
      visibility_m: 0, // filled by caller
      _tValues: tValues,
    }
  }
}

// ── Beer-Lambert conversion ──────────────────────────────────────────────────

function beerLambert(tMedian: number, calib: number): number {
  const clamped = Math.max(tMedian, 0.01) // avoid ln(0)
  return calib / -Math.log(clamped)
}

// ── High-level analyseVideo ──────────────────────────────────────────────────

export async function analyseVideo(
  file: File,
  opts: AnalyseOptions = {}
): Promise<VisibilityReport> {
  const calib = opts.calib ?? 4.0
  const downsample = opts.downsample ?? 0.5
  const maxFrames = opts.maxFrames ?? 60

  const engine = new UnderwaterVisibility()
  await engine.ready()

  // Phase 1: extract frames
  const imageFrames = await extractFrames(file, {
    maxFrames,
    onProgress: (cur, total) => opts.onProgress?.('extracting', cur, total),
  })

  // Phase 2: analyse each frame
  const frames: FrameResult[] = []
  const allVisibilities: number[] = []

  for (let i = 0; i < imageFrames.length; i++) {
    opts.onProgress?.('analysing', i + 1, imageFrames.length)

    const result = engine.analyseFrame(imageFrames[i], downsample)
    const vis = beerLambert(result.t_median, calib)

    const frame: FrameResult = {
      index: i,
      t_median: result.t_median,
      t_mean: result.t_mean,
      t_p10: result.t_p10,
      t_p90: result.t_p90,
      visibility_m: vis,
    }

    frames.push(frame)
    allVisibilities.push(vis)
  }

  // Aggregate stats
  const sorted = [...allVisibilities].sort((a, b) => a - b)
  const medianTAll = frames.map((f) => f.t_median).sort((a, b) => a - b)

  const report: VisibilityReport = {
    visibility_m: {
      median: percentile(sorted, 50),
      mean: sorted.reduce((s, v) => s + v, 0) / sorted.length,
      p10: percentile(sorted, 10),
      p90: percentile(sorted, 90),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    },
    t_median: percentile(medianTAll, 50),
    frames,
    frameCount: frames.length,
    calib,
  }

  // Run client-side validation
  report.validation = validateVideoMetrics(report)

  return report
}

// ── Client-side video validation ──────────────────────────────────────────────

export function validateVideoMetrics(report: VisibilityReport): VideoValidation {
  const warnings: string[] = []
  let score = 1.0

  // Check 1: Transmission range
  // Underwater DCP transmission medians typically fall between 0.05 and 0.85.
  // Very high t (>0.90) means clear air, not water.
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

  // Check 2: Visibility plausibility
  // Real underwater vis is 0.5\u201330m typically. >40m is suspicious.
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

  // Check 3: Frame consistency (P10\u2013P90 spread)
  const spread = report.visibility_m.p90 - report.visibility_m.p10
  const relativeSpread = spread / Math.max(report.visibility_m.median, 0.1)

  if (spread < 0.05 && report.frameCount > 3) {
    score -= 0.25
    warnings.push('Near-zero visibility variance \u2014 may not be real footage')
  }
  if (relativeSpread > 3.0) {
    score -= 0.2
    warnings.push('High variance \u2014 footage may contain non-underwater segments')
  }

  // Check 4: Minimum frame count
  if (report.frameCount < 3) {
    score -= 0.15
    warnings.push('Very few frames analysed \u2014 results may be unreliable')
  }

  const confidence = Math.max(0, Math.min(1, score))
  return {
    confidence: Math.round(confidence * 100) / 100,
    warnings,
    is_valid: confidence >= 0.3,
  }
}
