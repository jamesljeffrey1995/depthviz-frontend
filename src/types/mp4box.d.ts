// Minimal ambient types for mp4box.js. The package ships no TypeScript
// declarations; we only type the subset of the surface used for MP4 demuxing
// in the WebCodecs fallback path.
declare module 'mp4box' {
  export interface MP4VideoTrack {
    id: number
    codec: string
    track_width: number
    track_height: number
    nb_samples: number
    timescale: number
    duration: number
  }

  export interface MP4Info {
    videoTracks: MP4VideoTrack[]
    audioTracks: unknown[]
    duration: number
    timescale: number
  }

  export interface MP4Sample {
    data: Uint8Array
    cts: number
    dts: number
    duration: number
    is_sync: boolean
  }

  export interface MP4Box {
    onReady: ((info: MP4Info) => void) | null
    onError: ((err: string) => void) | null
    onSamples: ((trackId: number, ref: unknown, samples: MP4Sample[]) => void) | null
    appendBuffer(buffer: ArrayBuffer & { fileStart: number }): number
    flush(): void
    start(): void
    stop(): void
    setExtractionOptions(
      trackId: number,
      user: unknown,
      options: { nbSamples?: number; rapAlignement?: boolean },
    ): void
    // Returns the internal trak box; typed loosely because we only traverse it.
    getTrackById(id: number): unknown
  }

  export interface MP4BoxDataStream {
    buffer: ArrayBuffer
  }

  export interface MP4BoxDataStreamConstructor {
    BIG_ENDIAN: number
    LITTLE_ENDIAN: number
    new (arrayBuffer?: ArrayBuffer, byteOffset?: number, endianness?: number): MP4BoxDataStream
  }

  export const DataStream: MP4BoxDataStreamConstructor

  export function createFile(keepMdatData?: boolean): MP4Box

  const MP4BoxNS: {
    createFile: typeof createFile
    DataStream: MP4BoxDataStreamConstructor
  }
  export default MP4BoxNS
}
