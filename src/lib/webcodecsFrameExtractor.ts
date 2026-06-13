// Fallback frame extractor for environments where the `<video>` element refuses
// the source (classic symptom on iOS Safari + Photos-library MP4/HEVC files:
// SRC_NOT_SUPPORTED even after blob/ArrayBuffer/fresh-element retries).
//
// This path bypasses `<video>` entirely: mp4box.js demuxes the container and
// WebCodecs' VideoDecoder does the decoding. Supported on iOS Safari 16.4+
// and all modern desktop browsers.

import { createFile, DataStream, type MP4Box as MP4BoxFile, type MP4Info, type MP4Sample, type MP4VideoTrack } from 'mp4box'

export interface WebCodecsExtractOpts {
  maxFrames?: number
  onProgress?: (current: number, total: number) => void
  log?: (level: 'info' | 'warn', message: string) => void
}

/** Runtime check for the browser globals this path depends on. */
export function webCodecsSupported(): boolean {
  const g = globalThis as unknown as {
    VideoDecoder?: unknown
    EncodedVideoChunk?: unknown
  }
  return typeof g.VideoDecoder === 'function' && typeof g.EncodedVideoChunk === 'function'
}

export async function extractFramesViaWebCodecs(
  file: File,
  opts: WebCodecsExtractOpts = {},
): Promise<ImageData[]> {
  if (!webCodecsSupported()) {
    throw new Error('WebCodecs not available in this browser')
  }

  const maxFrames = opts.maxFrames ?? 60
  const log = opts.log ?? (() => {})

  log('info', 'reading file into memory for mp4box demux')
  const buffer = await file.arrayBuffer()

  const mp4 = createFile()

  // Parse the container.
  const info = await new Promise<{ track: MP4VideoTrack; info: MP4Info }>((resolve, reject) => {
    mp4.onError = (_module, message) => reject(new Error(`mp4box parse error: ${message}`))
    mp4.onReady = (parsed) => {
      const vt = parsed.videoTracks[0]
      if (!vt) {
        reject(new Error('no video track found in container'))
        return
      }
      resolve({ track: vt, info: parsed })
    }
    const tagged = buffer as ArrayBuffer & { fileStart: number }
    tagged.fileStart = 0
    mp4.appendBuffer(tagged)
    mp4.flush()
  })

  const { track, info: parsed } = info
  const durationSec = parsed.duration / parsed.timescale
  log(
    'info',
    `demuxed: codec=${track.codec} ${track.track_width}x${track.track_height} ` +
      `duration=${durationSec.toFixed(1)}s samples=${track.nb_samples}`,
  )

  const description = extractCodecDescription(mp4, track)

  const config: VideoDecoderConfig = {
    codec: track.codec,
    codedWidth: track.track_width,
    codedHeight: track.track_height,
    ...(description ? { description } : {}),
  }

  const support = await VideoDecoder.isConfigSupported(config)
  if (!support.supported) {
    throw new Error(`WebCodecs does not support codec "${track.codec}" on this device`)
  }

  // Evenly-spaced target timestamps (microseconds), matching extractFrames' cadence.
  const frameCount = Math.max(1, Math.min(maxFrames, Math.floor(durationSec * 2)))
  const interval = durationSec / (frameCount + 1)
  const targetsUs: number[] = []
  for (let i = 0; i < frameCount; i++) {
    targetsUs.push(Math.round(interval * (i + 1) * 1_000_000))
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  // Cap output resolution. At 4K (3840×2160) each RGBA frame is ~33 MB, and 58
  // of them overwhelm iOS Safari's web-worker memory budget — the subsequent
  // WASM import silently stalls. Downscaling to ≤ ANALYSIS_MAX_DIM along the
  // long edge gives DCP plenty of signal at a fraction of the memory.
  const ANALYSIS_MAX_DIM = 1280
  const srcW = track.track_width
  const srcH = track.track_height
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(srcW, srcH))
  const outW = Math.max(1, Math.round(srcW * scale))
  const outH = Math.max(1, Math.round(srcH * scale))
  canvas.width = outW
  canvas.height = outH
  if (scale < 1) {
    log('info', `downscaling frames ${srcW}×${srcH} → ${outW}×${outH} to fit worker memory`)
  }

  const frames: ImageData[] = []
  let nextTargetIdx = 0
  let decodeError: Error | null = null

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        if (nextTargetIdx < targetsUs.length && frame.timestamp >= targetsUs[nextTargetIdx]) {
          ctx.drawImage(frame, 0, 0, outW, outH)
          frames.push(ctx.getImageData(0, 0, outW, outH))
          opts.onProgress?.(frames.length, frameCount)
          nextTargetIdx++
        }
      } finally {
        frame.close()
      }
    },
    error: (e) => {
      decodeError = e instanceof Error ? e : new Error(String(e))
      log('warn', `VideoDecoder error: ${decodeError.message}`)
    },
  })

  decoder.configure(config)

  // Stream all samples through the decoder. Stop feeding once we've captured
  // every target frame — further decoding would be wasted work.
  let totalFed = 0
  let done = false
  await new Promise<void>((resolve, reject) => {
    mp4.onError = (_module, message) => reject(new Error(`mp4box extract error: ${message}`))
    mp4.onSamples = (_trackId, _ref, samples: MP4Sample[]) => {
      if (done) return
      for (const s of samples) {
        if (nextTargetIdx >= targetsUs.length) {
          done = true
          break
        }
        if (decodeError) {
          reject(decodeError)
          return
        }
        try {
          const chunk = new EncodedVideoChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: (s.cts * 1_000_000) / track.timescale,
            duration: (s.duration * 1_000_000) / track.timescale,
            data: s.data,
          })
          decoder.decode(chunk)
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }
        totalFed++
      }
      if (done || totalFed >= track.nb_samples) {
        // Drain any in-flight frames, then resolve.
        decoder
          .flush()
          .then(() => resolve())
          .catch((err) => reject(err instanceof Error ? err : new Error(String(err))))
      }
    }
    mp4.setExtractionOptions(track.id, null, { nbSamples: 500 })
    mp4.start()
  })

  try {
    decoder.close()
  } catch {
    /* already closed */
  }

  if (frames.length === 0) {
    throw new Error('WebCodecs decoded no frames from this video')
  }

  log('info', `WebCodecs extracted ${frames.length} frames`)
  return frames
}

/** Read the codec-private data (avcC / hvcC / vpcC / av1C) out of the track's
 *  sample description so VideoDecoder can be configured. Without this,
 *  H.264/HEVC decode fails with "codec description required". */
function extractCodecDescription(
  mp4: MP4BoxFile,
  track: MP4VideoTrack,
): Uint8Array | undefined {
  // getTrackById returns the internal trak box — walk to the sample description.
  const trak = mp4.getTrackById(track.id) as {
    mdia?: { minf?: { stbl?: { stsd?: { entries?: Array<Record<string, unknown>> } } } }
  } | null
  const entries = trak?.mdia?.minf?.stbl?.stsd?.entries
  if (!entries) return undefined

  const codec = track.codec.toLowerCase()
  const boxKey = codec.startsWith('avc')
    ? 'avcC'
    : codec.startsWith('hvc') || codec.startsWith('hev')
      ? 'hvcC'
      : codec.startsWith('vp0') || codec.startsWith('vp8') || codec.startsWith('vp9')
        ? 'vpcC'
        : codec.startsWith('av01')
          ? 'av1C'
          : null
  if (!boxKey) return undefined

  for (const entry of entries) {
    const box = entry[boxKey] as { write: (s: { buffer: ArrayBuffer }) => void } | undefined
    if (!box) continue
    const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN)
    box.write(stream)
    // Box is written with its 8-byte header (size + type); description must skip it.
    return new Uint8Array(stream.buffer, 8)
  }
  return undefined
}
