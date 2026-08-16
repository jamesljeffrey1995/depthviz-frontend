/**
 * Wave-height unit conversion + water-quality classification helpers.
 *
 * Centralised here (rather than living inline in DayDetail) so each
 * pure function can be unit-tested in isolation. Both the API and these
 * helpers must stay in sync — a regression where the same nutrient_factor
 * produces different labels in m vs. ft views is the bug we're guarding
 * against in tests/units.test.ts.
 */

export type Units = 'ft' | 'm'

/** Metres → feet conversion factor (matches services/visibility.py:_M_TO_FT). */
export const M_TO_FT = 3.28084
export const FT_TO_M = 1 / M_TO_FT

export function metresToFeet(m: number): number {
  return m * M_TO_FT
}

export function feetToMetres(ft: number): number {
  return ft * FT_TO_M
}

/**
 * Visibility values are always delivered by the forecast model in metres.
 * Wave and swell heights may already be converted by the API, so visibility
 * conversion deliberately lives in this small, explicitly named helper.
 */
export function visibilityInUnits(metres: number, units: Units): number {
  return units === 'ft' ? metresToFeet(metres) : metres
}

/** Human-readable whole-unit depth for controls and safety guidance. */
export function formatDepth(metres: number, units: Units): string {
  return units === 'ft' ? `${Math.round(metresToFeet(metres))} ft` : `${metres} m`
}

export interface WaterQuality {
  label: string
  color: string
  description: string
}

/**
 * Classify a nutrient factor (0–1, satellite-chlorophyll derived) into a
 * trophic-state band. The factor is unit-agnostic — the same value MUST
 * always produce the same band regardless of which wave-height unit the
 * caller is using.
 */
export function getWaterQuality(factor: number): WaterQuality {
  if (factor < 0.3) return { label: 'Nutrient-poor',      color: '#237744', description: 'Oligotrophic — algae blooms rare' }
  if (factor < 0.6) return { label: 'Moderate nutrients', color: '#985c16', description: 'Some bloom potential in warm conditions' }
  if (factor < 0.8) return { label: 'Nutrient-rich',      color: '#a2571b', description: 'Eutrophic — elevated bloom risk when warm' }
  return              { label: 'Highly eutrophic',         color: '#bd3a3a', description: 'High nutrient load — bloom penalty fully applied' }
}
