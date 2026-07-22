/**
 * Wave-height unit conversion + water-quality classification helpers.
 *
 * Centralised here (rather than living inline in DayDetail) so each
 * pure function can be unit-tested in isolation. Both the API and these
 * helpers must stay in sync — a regression where the same nutrient_factor
 * produces different labels in m vs. ft views is the bug we're guarding
 * against in tests/units.test.ts.
 */

import { SEVERITY_TOKEN } from './severity'

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
  if (factor < 0.3) return { label: 'Nutrient-poor',      color: SEVERITY_TOKEN.safe,     description: 'Oligotrophic — algae blooms rare' }
  if (factor < 0.6) return { label: 'Moderate nutrients', color: SEVERITY_TOKEN.low,      description: 'Some bloom potential in warm conditions' }
  if (factor < 0.8) return { label: 'Nutrient-rich',      color: SEVERITY_TOKEN.moderate, description: 'Eutrophic — elevated bloom risk when warm' }
  return              { label: 'Highly eutrophic',         color: SEVERITY_TOKEN.high,      description: 'High nutrient load — bloom penalty fully applied' }
}
