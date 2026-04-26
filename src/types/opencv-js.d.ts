// Type shim for @techstark/opencv-js. The package ships its own type
// declarations, but some toolchains (older TS, non-"bundler" moduleResolution,
// stale IDE indexes) fail to resolve them. This ambient declaration makes
// `import cv from '@techstark/opencv-js'` and `await import(...)` always
// type-check — we use it via `any` anyway because the runtime surface is
// the Emscripten cv Module, which the package's own types don't fully model.
declare module '@techstark/opencv-js' {
  const cv: any
  export default cv
}
