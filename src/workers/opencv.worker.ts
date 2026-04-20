/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
// Static import: bundling OpenCV into the worker chunk avoids a runtime fetch
// that was observed to hang silently on iOS Safari workers under memory
// pressure, leaving no chance for the WASM-init timeout (set *after* the
// import resolves) to fire.
import cvModule from '@techstark/opencv-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FrameData {
  buffer: ArrayBuffer
  width: number
  height: number
}

interface FrameResult {
  index: number
  t_median: number
  t_mean: number
  t_p10: number
  t_p90: number
  visibility_m: number
}

// ── Messaging ─────────────────────────────────────────────────────────────────

type FromWorker =
  | { type: 'log'; level: 'info' | 'warn'; message: string }
  | { type: 'progress'; phase: 'analysing'; current: number; total: number }
  | { type: 'result'; report: any }
  | { type: 'error'; message: string }

function post(msg: FromWorker) {
  ;(self as DedicatedWorkerGlobalScope).postMessage(msg)
}
const log = (m: string) => post({ type: 'log', level: 'info', message: m })
const warn = (m: string) => post({ type: 'log', level: 'warn', message: m })

// ── Helpers ───────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function beerLambert(tMedian: number, calib: number): number {
  return calib / -Math.log(Math.max(tMedian, 0.01))
}

// ── OpenCV init ───────────────────────────────────────────────────────────────

const cv: any = (cvModule as any).default ?? cvModule
let cvInitPromise: Promise<void> | null = null

function initOpenCV(): Promise<void> {
  if (cvInitPromise) return cvInitPromise
  cvInitPromise = new Promise<void>((resolve, reject) => {
    log('waiting for OpenCV WASM runtime…')
    if (cv?.Mat) { log('OpenCV ready in worker'); resolve(); return }
    const prev = typeof cv?.onRuntimeInitialized === 'function' ? cv.onRuntimeInitialized : null
    const t = setTimeout(() => reject(new Error('WASM init timed out after 30s')), 30_000)
    cv.onRuntimeInitialized = () => {
      clearTimeout(t)
      if (prev) try { prev() } catch { /* ignore */ }
      log('onRuntimeInitialized fired — OpenCV ready in worker')
      resolve()
    }
  })
  return cvInitPromise
}

// ── Frame analysis (DCP) ──────────────────────────────────────────────────────

function analyseFrame(
  frame: FrameData,
  downsample: number,
): { t_median: number; t_mean: number; t_p10: number; t_p90: number } {
  const imageData = new ImageData(new Uint8ClampedArray(frame.buffer), frame.width, frame.height)

  let src = cv.matFromImageData(imageData)

  if (downsample < 1) {
    const dst = new cv.Mat()
    cv.resize(src, dst, new cv.Size(
      Math.round(src.cols * downsample),
      Math.round(src.rows * downsample),
    ), 0, 0, cv.INTER_AREA)
    src.delete()
    src = dst
  }

  const rgb = new cv.Mat()
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
  src.delete()

  const channels = new cv.MatVector()
  cv.split(rgb, channels)
  const R = channels.get(0), G = channels.get(1), B = channels.get(2)

  const meanR = cv.mean(R)[0], meanG = cv.mean(G)[0], meanB = cv.mean(B)[0]
  const boost = Math.min((meanG + meanB) / 2 / Math.max(meanR, 1), 3.0)
  if (boost > 1.01) {
    const d = R.data
    for (let i = 0; i < d.length; i++) d[i] = Math.min(255, Math.round(d[i] * boost))
  }

  const compensated = new cv.Mat()
  cv.merge(channels, compensated)
  R.delete(); G.delete(); B.delete(); channels.delete(); rgb.delete()

  const floatImg = new cv.Mat()
  compensated.convertTo(floatImg, cv.CV_32FC3, 1.0 / 255.0)
  compensated.delete()

  const fc = new cv.MatVector()
  cv.split(floatImg, fc)
  const fR = fc.get(0), fG = fc.get(1), fB = fc.get(2)

  const minRG = new cv.Mat(), darkRaw = new cv.Mat()
  cv.min(fR, fG, minRG); cv.min(minRG, fB, darkRaw); minRG.delete()

  const ksz = 15
  const k1 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ksz, ksz))
  const darkChannel = new cv.Mat()
  cv.erode(darkRaw, darkChannel, k1); k1.delete(); darkRaw.delete()

  const dcData = new Float32Array(darkChannel.data32F)
  const numPx = dcData.length
  const dcThreshold = Float32Array.from(dcData).sort()[numPx - Math.max(1, Math.floor(numPx * 0.001))]

  const fRd = fR.data32F, fGd = fG.data32F, fBd = fB.data32F
  let sAR = 0, sAG = 0, sAB = 0, cA = 0
  for (let i = 0; i < numPx; i++) {
    if (dcData[i] >= dcThreshold) { sAR += fRd[i]; sAG += fGd[i]; sAB += fBd[i]; cA++ }
  }
  const A = [sAR / Math.max(cA, 1), sAG / Math.max(cA, 1), sAB / Math.max(cA, 1)]

  const nR = new cv.Mat(), nG = new cv.Mat(), nB = new cv.Mat()
  fR.convertTo(nR, cv.CV_32F, 1 / Math.max(A[0], 1e-6))
  fG.convertTo(nG, cv.CV_32F, 1 / Math.max(A[1], 1e-6))
  fB.convertTo(nB, cv.CV_32F, 1 / Math.max(A[2], 1e-6))
  fR.delete(); fG.delete(); fB.delete(); fc.delete(); floatImg.delete()

  const mNRG = new cv.Mat(), darkNorm = new cv.Mat()
  cv.min(nR, nG, mNRG); cv.min(mNRG, nB, darkNorm)
  nR.delete(); nG.delete(); nB.delete(); mNRG.delete()

  const k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ksz, ksz))
  const darkNormE = new cv.Mat()
  cv.erode(darkNorm, darkNormE, k2); k2.delete(); darkNorm.delete()

  const tData = new Float32Array(darkNormE.data32F)
  const tValues = new Array<number>(tData.length)
  for (let i = 0; i < tData.length; i++) tValues[i] = Math.max(0, Math.min(1, 1 - 0.95 * tData[i]))
  darkNormE.delete(); darkChannel.delete()

  tValues.sort((a, b) => a - b)
  return {
    t_median: percentile(tValues, 50),
    t_mean: tValues.reduce((s, v) => s + v, 0) / tValues.length,
    t_p10: percentile(tValues, 10),
    t_p90: percentile(tValues, 90),
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

;(self as DedicatedWorkerGlobalScope).onmessage = async (
  e: MessageEvent<{ type: 'analyse'; frames: FrameData[]; calib: number; downsample: number }>,
) => {
  if (e.data.type !== 'analyse') return

  const { frames, calib, downsample } = e.data

  try {
    await initOpenCV()
  } catch (err) {
    warn(`OpenCV init failed: ${err}`)
    post({ type: 'error', message: `OpenCV failed to load: ${err}` })
    return
  }

  const frameResults: FrameResult[] = []
  const allVis: number[] = []

  for (let i = 0; i < frames.length; i++) {
    post({ type: 'progress', phase: 'analysing', current: i + 1, total: frames.length })
    const r = analyseFrame(frames[i], downsample)
    const vis = beerLambert(r.t_median, calib)
    frameResults.push({ index: i, ...r, visibility_m: vis })
    allVis.push(vis)
  }

  const sorted = [...allVis].sort((a, b) => a - b)
  const medianTAll = frameResults.map(f => f.t_median).sort((a, b) => a - b)

  post({
    type: 'result',
    report: {
      visibility_m: {
        median: percentile(sorted, 50),
        mean: sorted.reduce((s, v) => s + v, 0) / sorted.length,
        p10: percentile(sorted, 10),
        p90: percentile(sorted, 90),
        min: sorted[0],
        max: sorted[sorted.length - 1],
      },
      t_median: percentile(medianTAll, 50),
      frames: frameResults,
      frameCount: frameResults.length,
      calib,
    },
  })
}
