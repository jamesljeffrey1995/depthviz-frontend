export type TelemetryPayload = Record<string, unknown>

export function trackClientEvent(event: string, payload: TelemetryPayload = {}) {
  const detail = { event, payload, timestamp: Date.now() }
  try {
    window.dispatchEvent(new CustomEvent('depthviz:telemetry', { detail }))
  } catch {
    // Best-effort only — never break UX on telemetry failure.
  }

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event, payload)
  }
}
