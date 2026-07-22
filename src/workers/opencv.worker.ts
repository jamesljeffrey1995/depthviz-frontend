/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
// Static import: bundling OpenCV into the worker chunk avoids a runtime fetch
// that was observed to hang silently on iOS Safari workers under memory
// pressure, leaving no chance for the WASM-init timeout (set *after* the
// import resolves) to fire.
import cvModule from '@techstark/opencv-js'
import { beerLambert, percentile, transmissionFromDarkChannel } from '../lib/visibilityMath'

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

  // Underwater Dark Channel Prior (UDCP — Drews et al. 2013).
  //
  // Red light is absorbed within the first few metres underwater, so the red
  // channel is near-zero and carries almost no backscatter signal. The classic
  // DCP takes the dark channel over all of R, G, B — but underwater that makes
  // min(R,G,B) ≈ 0 across the whole frame, so transmission collapses to ≈ 1
  // ("no haze"), visibility pins at the cap with near-zero variance, and the
  // result trips the "video does not appear to be underwater" validation even
  // for genuine dive footage. UDCP builds the dark channel from the green and
  // blue channels only — the wavelengths that actually carry the water's
  // veiling/backscatter — which restores a meaningful transmission estimate.
  const floatImg = new cv.Mat()
  rgb.convertTo(floatImg, cv.CV_32FC3, 1.0 / 255.0)
  rgb.delete()

  const fc = new cv.MatVector()
  cv.split(floatImg, fc)
  const fR = fc.get(0), fG = fc.get(1), fB = fc.get(2)
  fR.delete()   // red is excluded from the underwater dark channel

  const ksz = 15

  // Raw dark channel over {G, B}; atmospheric light = mean of its brightest px.
  const darkRaw = new cv.Mat()
  cv.min(fG, fB, darkRaw)
  const k1 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ksz, ksz))
  const darkChannel = new cv.Mat()
  cv.erode(darkRaw, darkChannel, k1); k1.delete(); darkRaw.delete()

  const dcData = new Float32Array(darkChannel.data32F)
  const numPx = dcData.length
  const dcThreshold = Float32Array.from(dcData).sort()[numPx - Math.max(1, Math.floor(numPx * 0.001))] ?? 0

  const fGd = fG.data32F, fBd = fB.data32F
  let sAG = 0, sAB = 0, cA = 0
  for (let i = 0; i < numPx; i++) {
    if (dcData[i]! >= dcThreshold) { sAG += fGd[i]; sAB += fBd[i]; cA++ }
  }
  const AG = sAG / Math.max(cA, 1), AB = sAB / Math.max(cA, 1)

  const nG = new cv.Mat(), nB = new cv.Mat()
  fG.convertTo(nG, cv.CV_32F, 1 / Math.max(AG, 1e-6))
  fB.convertTo(nB, cv.CV_32F, 1 / Math.max(AB, 1e-6))
  fG.delete(); fB.delete(); fc.delete(); floatImg.delete()

  const darkNorm = new cv.Mat()
  cv.min(nG, nB, darkNorm)
  nG.delete(); nB.delete()

  const k2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(ksz, ksz))
  const darkNormE = new cv.Mat()
  cv.erode(darkNorm, darkNormE, k2); k2.delete(); darkNorm.delete()

  const tData = new Float32Array(darkNormE.data32F)
  const tValues = new Array<number>(tData.length)
  for (let i = 0; i < tData.length; i++) tValues[i] = transmissionFromDarkChannel(tData[i]!)
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
    const r = analyseFrame(frames[i]!, downsample)
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
