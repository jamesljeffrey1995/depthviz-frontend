// Re-export underwater visibility types for convenience
export type {
  FrameResult,
  VisibilityStats,
  VisibilityReport as UnderwaterVisibilityReport,
  AnalyseOptions,
} from '../lib/underwaterVisibility'

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

export interface Resuspension {
  depth_m: number | null
  bottom_orbital_velocity: number | null
  bed_shear_stress: number | null
  risk_level: string
  penalty: number
  note: string | null
}

export interface RiverDischarge {
  discharge_m3s: number | null
  discharge_mean: number | null
  discharge_ratio: number | null
  risk_level: string
  penalty: number
  note: string | null
}

export interface WaterQuality {
  bgc_kd: number | null
  bgc_kd_vis: number | null
  bgc_source: string | null
  erddap_chlorophyll: number | null
  erddap_kd490: number | null
  erddap_kd490_vis: number | null
  erddap_obs_date: string | null
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
  resuspension: Resuspension | null
  river_discharge: RiverDischarge | null
  water_quality: WaterQuality | null
}

export interface ForecastResponse {
  location_name: string
  lat: number
  lon: number
  days: DayForecast[]
  bias_offset: number | null
  report_count: number
  model_confidence: 'none' | 'low' | 'medium' | 'high'
  calibration_active: boolean
}

export interface BestVisSpot {
  name: string
  lat: number
  lon: number
  day: DayForecast
}

export interface BestVisResponse {
  spots: BestVisSpot[]
  failedCount?: number
}

export interface Location {
  id: number
  name: string
  lat: number
  lon: number
  is_public: boolean
  is_predefined: boolean
  vote_count: number
  user_vote: 'up' | 'down' | null
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
  // Video-derived visibility (client-side DCP analysis)
  video_vis_median?: number
  video_vis_p10?: number
  video_vis_p90?: number
  video_t_median?: number
  video_frame_count?: number
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
export type VerdictLabel = 'STAY ASHORE' | 'POOR' | 'LIMITED' | 'MARGINAL' | 'DECENT' | 'GOOD' | 'EXCELLENT'

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

export type AppView = 'forecast' | 'locations' | 'report' | 'tides' | 'map' | 'best'

export interface LocationHistoryLog {
  id: number
  date: string
  diver: string
  actual_vis: number
  predicted_vis: number
  error: number
  wave_height: number | null
  swell_height: number | null
  wind_speed: number | null
  notes: string | null
}

export interface LocationHistoryResponse {
  location_id: number
  location_name: string
  report_count: number
  logs: LocationHistoryLog[]
}

// Admin types
export interface AdminStats {
  total_reports: number
  quarantined_reports: number
  active_reports: number
  quarantine_rate: number
  total_locations: number
}

export interface OutlierPreview {
  total_reports: number
  locations: number
  would_quarantine: OutlierPreviewItem[]
  would_restore: OutlierPreviewItem[]
  would_quarantine_count: number
  would_restore_count: number
}

export interface OutlierPreviewItem {
  id: number
  location_id: number
  report_date: string
  actual_vis: number
  user_id: string
}

export interface CleaningResult {
  total_reports_scanned: number
  locations_scanned: number
  newly_quarantined: number
  newly_restored: number
  trust_weights_updated: number
  quarantined_report_ids: number[]
  restored_report_ids: number[]
}

export interface QuarantinedReport {
  id: number
  location_id: number
  location_name: string
  user_id: string
  report_date: string
  actual_vis: number
  predicted_vis: number
  trust_weight: number
  notes: string | null
  created_at: string
}

export interface QuarantinedListResponse {
  count: number
  reports: QuarantinedReport[]
}

// ML Model Status
export interface MLCalibration {
  swell_multiplier: number
  wind_multiplier: number
  rain_multiplier: number
  sample_count: number
  mae: number | null
  rmse: number | null
  r2_score: number | null
  updated_at: string | null
}

export interface MLBiasDetail {
  location_id: number
  location_name: string
  bias_offset: number
  r2_score: number | null
  sample_count: number
  updated_at: string | null
}

export interface MLTrainingLogEntry {
  trigger: string
  swell_multiplier: number | null
  wind_multiplier: number | null
  rain_multiplier: number | null
  global_mae: number | null
  global_rmse: number | null
  sample_count: number
  locations_updated: number
  duration_ms: number
  created_at: string
}

export interface MLStatus {
  calibration: MLCalibration | null
  bias_summary: {
    count: number
    avg_bias_offset: number | null
    avg_r2_score: number | null
    total_samples: number
  }
  bias_details: MLBiasDetail[]
  live_metrics: {
    mae: number | null
    rmse: number | null
    r2: number | null
    n: number
  }
  training_log: MLTrainingLogEntry[]
}

export interface MLRetrainResult {
  calibration: {
    swell_multiplier: number | null
    wind_multiplier: number | null
    rain_multiplier: number | null
    sample_count: number
  }
  locations_updated: number
  duration_ms: number
  metrics: {
    mae: number | null
    rmse: number | null
    r2: number | null
    n: number
  }
}

// Social / Friends
export interface Friend {
  friendship_id: number
  uid: string
  display_name: string
  report_count: number
  mean_accuracy: number | null
  trusted: boolean
}

export interface FriendRequest {
  id: number
  from_uid: string
  from_name: string
  created_at: string
}

export interface UserSearchResult {
  uid: string
  display_name: string
  report_count: number
  trusted: boolean
  friendship_status: string | null  // "accepted", "pending", "declined", or null
}

// Catches
export interface CatchCreate {
  location_id: number
  catch_date: string
  species: string
  weight_kg?: number
  length_cm?: number
  quantity?: number
  method?: string
  depth_m?: number
  notes?: string
  photo_url?: string
  water_temp?: number
  visibility?: number
  tide_state?: string
  moon_phase?: string
}

export interface CatchRead extends CatchCreate {
  id: number
  user_id: string
  created_at: string
}

// Feed
export interface FeedItem {
  type: 'report' | 'catch'
  id: number
  user_id: string
  user_name: string
  location_name: string
  location_id: number
  created_at: string
  // report fields
  actual_vis?: number
  predicted_vis?: number
  notes?: string
  has_video?: boolean
  // catch fields
  species?: string
  weight_kg?: number
  quantity?: number
  method?: string
}
