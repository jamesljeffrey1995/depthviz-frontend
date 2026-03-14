export interface AlgaeRisk {
  risk: 'low' | 'moderate' | 'high'
  score: number
  drivers: string[]
}

export interface VisibilityFactor {
  name: string
  value: string
  note?: string | null
  penalty: number
  max_penalty: number
}

export interface DayForecast {
  date: string
  is_forecast: boolean
  vis_estimate: number
  vis_corrected: number | null
  verdict: string
  color_class: string
  wave_height: number
  swell_height: number
  wind_speed: number
  wind_dir: number
  wind_dir_label: string
  precipitation: number
  air_temp: number
  sea_temp: number | null
  humidity: number
  algae: AlgaeRisk
  factors: VisibilityFactor[]
  nutrient_factor: number | null
  turbidity_penalty: number | null
}

export interface ForecastResponse {
  location_name: string
  lat: number
  lon: number
  days: DayForecast[]
  bias_offset: number | null
  report_count: number
}

export interface Location {
  id: number
  name: string
  lat: number
  lon: number
}

export interface ReportCreate {
  location_id: number
  report_date: string
  actual_vis: number
  predicted_vis: number
  wave_height?: number
  swell_height?: number
  wind_speed?: number
  wind_dir?: number
  precipitation?: number
  air_temp?: number
  sea_temp?: number | null
  algae_risk?: string
  notes?: string
}

export interface ReportRead extends ReportCreate {
  id: number
  user_id: string
  trust_weight: number
  is_quarantined: boolean
  created_at: string
}

export interface UserProfile {
  supabase_uid: string
  email: string
  display_name: string | null
  report_count: number
  mean_accuracy: number | null
  trusted: boolean
}

export interface LeaderboardEntry {
  display_name: string
  report_count: number
  mean_accuracy: number | null
  trusted: boolean
}

export interface GeocodingResult {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

export function formatLocationName(r: GeocodingResult): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ')
}

export type ImpactLevel = 'NO IMPACT' | 'LOW IMPACT' | 'MODERATE' | 'HIGH IMPACT' | 'SEVERE'
export type VerdictLabel = 'STAY ASHORE' | 'NOT WORTH IT' | 'VERY POOR' | 'MARGINAL' | 'DECENT' | 'GOOD' | 'EXCELLENT'

export interface Verdict {
  label: VerdictLabel
  colorClass: ColorClass
  alert: string | null
}

export interface VisibilityResult {
  vis: number
  factors: VisibilityFactor[]
  verdict: Verdict
}

export interface ConditionsData {
  weather: {
    current: {
      wind_speed_10m?: number
      precipitation?: number
      relative_humidity_2m?: number
      wind_direction_10m?: number
    }
  }
  marine: {
    current?: {
      wave_height?: number
      wave_period?: number
      swell_wave_height?: number
    }
  }
  histWeather?: {
    hourly: {
      time: string[]
      precipitation: number[]
      wind_speed_10m: number[]
    }
  }
  histMarine?: {
    hourly: {
      time: string[]
      wave_height: number[]
      swell_wave_height: number[]
    }
  }
}

export type ColorClass = 'blocked' | 'poor' | 'marginal' | 'decent' | 'good' | 'excellent'
// Tides & Currents
export interface TideEvent {
  time: string
  height: number | null
  type: 'high' | 'low'
}

export interface HourlyTide {
  time: string
  height: number | null
}

export interface CurrentState {
  state: 'slack' | 'weak' | 'moderate' | 'strong'
  direction: 'flooding' | 'ebbing' | 'slack'
  speed_knots: number | null
}

export interface TidesResponse {
  location_name: string
  lat: number
  lon: number
  date: string
  datum: string
  events: TideEvent[]
  hourly: HourlyTide[]
  current: CurrentState
  tidal_range_m: number
  range_category: 'micro' | 'meso' | 'macro'
}

export type AppView = 'forecast' | 'locations' | 'report' | 'tides' | 'map'
