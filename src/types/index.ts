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
  seabed_class: SeabedClass | null
  critical_shear: number | null
  resuspension_risk: number
  recovery_state: number
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
  distance_km: number | null
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

export interface SatelliteLayer {
  kind: 'true_colour' | 'sentinel2' | 'chlorophyll'
  title: string
  url: string
  image_date: string
  is_exact_date: boolean
  source: string
  attribution: string
  description: string
}

export interface SatelliteImagery {
  lat: number
  lon: number
  bbox: [number, number, number, number]
  layers: SatelliteLayer[]
}

export interface SwellComponent {
  type: 'primary' | 'secondary' | 'wind_wave'
  label: string
  height: number
  direction: number | null
  dir_label: string | null
}

export interface SimilarReport {
  date: string
  actual_vis: number
  model_predicted: number
  error: number
  conditions: string
  similarity: number
}

export interface KnnBiasResult {
  bias: number
  logs_used: number
  logs_excluded: number
  outliers_softened: number
  confidence: 'insufficient_data' | 'low' | 'medium' | 'high'
  mean_distance: number | null
}

export interface BiasAttribution {
  similar_reports: SimilarReport[]
  mean_error: number
  total_reports: number
  knn: KnnBiasResult | null
}

export interface DayForecast {
  date: string
  is_forecast: boolean
  vis_estimate: number
  vis_corrected: number | null
  vis_corrected_offset: number | null
  verdict: string
  color_class: string
  wave_height: number
  swell_height: number
  swell_period: number | null
  swell_direction: number | null
  swell_dir_label: string | null
  swell_components: SwellComponent[]
  wind_speed: number
  wind_dir: number
  wind_dir_label: string
  precipitation: number
  air_temp: number
  sea_temp: number | null
  humidity: number
  cloud_cover: number | null
  algae: AlgaeRisk
  factors: VisibilityFactor[]
  nutrient_factor: number | null
  turbidity_penalty: number | null
  resuspension: Resuspension | null
  river_discharge: RiverDischarge | null
  water_quality: WaterQuality | null
  bias_attribution: BiasAttribution | null
}

export interface ForecastResponse {
  location_name: string
  lat: number
  lon: number
  days: DayForecast[]
  bias_offset: number | null
  global_bias_offset: number | null
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

export type SeabedClass = 'rock' | 'gravel' | 'sand' | 'mixed' | 'mud'

export interface Location {
  id: number
  name: string
  lat: number
  lon: number
  is_public: boolean
  is_predefined: boolean
  vote_count: number
  user_vote: 'up' | 'down' | null
  encrypted_lat: string | null
  encrypted_lon: string | null
  // Per-site bathymetry/substrate for the seabed-resuspension model (#155).
  depth_m: number | null
  seabed_class: SeabedClass | null
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
  // Water clarity shown in the forecast at dive time — lets the model learn
  // from a measured algae signal instead of the heuristic algae_risk label.
  chlorophyll?: number | null
  kd490?: number | null
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
  // Server-verified admin flag from /profile/me. The backend re-checks admin
  // identity on every /admin/* route, so this only controls UI visibility.
  is_admin: boolean
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

export interface DataOverviewTopLocation {
  location_id: number
  location_name: string
  report_count: number
  latest_report: string | null
}

export interface DataOverviewContributor {
  user_id: string
  name: string
  report_count: number
  mean_accuracy: number | null
  trusted: boolean
}

export interface DataOverviewActivityDay {
  date: string
  count: number
}

export interface DataOverview {
  volume: {
    total_reports: number
    active_reports: number
    quarantined_reports: number
    total_locations: number
    total_users: number
    total_catches: number
    total_disputes: number
    weather_observations: number
  }
  growth: {
    reports_7d: number
    reports_30d: number
    catches_30d: number
    new_users_30d: number
  }
  freshness: {
    latest_report: string | null
    latest_catch: string | null
    latest_observation: string | null
  }
  quality: {
    reports_with_video: number
    reports_with_satellite: number
    video_coverage_pct: number
    satellite_coverage_pct: number
    avg_trust_weight: number | null
    avg_user_accuracy: number | null
  }
  disputes_by_status: Record<string, number>
  coverage: {
    locations_with_reports: number
    locations_without_reports: number
    top_locations: DataOverviewTopLocation[]
  }
  contributors: {
    total: number
    top: DataOverviewContributor[]
  }
  activity: DataOverviewActivityDay[]
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
  quarantine_reason?: string
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
  global_bias_offset: number
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
    baseline_mae?: number | null
    baseline_rmse?: number | null
    baseline_r2?: number | null
  }
  training_log: MLTrainingLogEntry[]
}

export interface MLPredictionPoint {
  date: string
  actual: number
  predicted: number
  error: number
  location: string
}

export interface MLResidual {
  id: number
  date: string
  location: string
  actual: number
  predicted: number
  error: number
  abs_error: number
  trust_weight: number
  video_confidence: number | null
}

export interface MLResidualSummary {
  n: number
  mae: number | null
  sse: number
  top3_sse_share: number | null
}

export interface MLPredictions {
  points: MLPredictionPoint[]
  count: number
  residuals: MLResidual[]
  summary: MLResidualSummary | null
}

export interface MLRetrainResult {
  calibration: {
    swell_multiplier: number | null
    wind_multiplier: number | null
    rain_multiplier: number | null
    global_bias_offset: number
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

// Feature Importance
export interface FeatureImportance {
  name: string
  label: string
  correlation: number
  abs_correlation: number
  variance_explained: number
  mean: number
  std: number
  n: number
}

export interface FeatureImportanceResponse {
  features: FeatureImportance[]
  summary: {
    total_reports: number
    mean_visibility: number
    std_visibility: number
    calibration_active: boolean
    swell_multiplier: number
    wind_multiplier: number
    rain_multiplier: number
    sample_count: number
    updated_at: string | null
  }
  n: number
}

// Apnea training tables
export type ApneaTableType = 'o2' | 'co2' | 'custom'
export type ApneaDifficulty = 'beginner' | 'intermediate' | 'expert'

export interface ApneaCycle {
  hold_seconds: number
  rest_seconds: number
}

export interface ApneaTable {
  id: number
  user_id: string | null
  name: string
  description: string | null
  table_type: ApneaTableType
  difficulty: ApneaDifficulty
  cycles: ApneaCycle[]
  is_public: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface ApneaTableCreate {
  name: string
  description?: string | null
  table_type: ApneaTableType
  difficulty: ApneaDifficulty
  cycles: ApneaCycle[]
  is_public?: boolean
}

// Data Disputes
export interface DataDisputeCreate {
  location_id?: number
  report_date: string
  field_disputed: string
  reported_value: number
  forecast_value?: number
  image_url?: string
}

export interface DataDispute {
  id: number
  location_id: number | null
  user_id: string
  report_date: string
  field_disputed: string
  reported_value: number
  forecast_value: number | null
  image_url: string | null
  ai_extracted_value: number | null
  ai_confidence: number | null
  ai_notes: string | null
  status: 'pending' | 'accepted' | 'rejected'
  admin_notes: string | null
  created_at: string
}

export interface ApneaTableUpdate {
  name?: string
  description?: string | null
  table_type?: ApneaTableType
  difficulty?: ApneaDifficulty
  cycles?: ApneaCycle[]
  is_public?: boolean
}

// ── News / Announcements ──────────────────────────────────────────────────
export interface Announcement {
  id: number
  title: string
  summary: string | null
  body: string
  category: string | null
  author_name: string
  is_published: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface AnnouncementInput {
  title: string
  summary?: string | null
  body: string
  category?: string | null
  is_published?: boolean
  is_pinned?: boolean
}

// ── Discussion forum ──────────────────────────────────────────────────────
export interface ForumCategory {
  id: number
  slug: string
  name: string
  description: string | null
  thread_count: number
}

export interface ForumThreadSummary {
  id: number
  title: string
  author_name: string
  reply_count: number
  is_locked: boolean
  is_pinned: boolean
  created_at: string
  last_post_at: string
}

export interface ForumPost {
  id: number
  body: string
  author_name: string
  author_uid: string
  created_at: string
}

export interface ForumThreadDetail {
  thread: {
    id: number
    title: string
    author_name: string
    author_uid: string
    is_locked: boolean
    is_pinned: boolean
    reply_count: number
    created_at: string
    category: { slug: string; name: string } | null
  }
  posts: ForumPost[]
}

export interface ForumCategoryView {
  category: { id: number; slug: string; name: string; description: string | null }
  threads: ForumThreadSummary[]
  total: number
}

// ── Competition operations (admin-only) ────────────────────────────────────
// Mirrors the /admin/competition API. None of this is ever exposed publicly;
// the frontend gates the whole area on the server-verified `is_admin` flag and
// the backend re-checks require_admin on every request.

export type CompetitionStatus =
  | 'draft' | 'open' | 'active' | 'weigh_in' | 'finished' | 'cancelled'
export type CompetitionVisibility = 'admin' | 'released'
export type CompetitorStatus =
  | 'not_arrived' | 'registered' | 'in_water' | 'returned' | 'late' | 'withdrawn'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'experienced'
export type IncidentType =
  | 'late_return' | 'injury' | 'lost_contact' | 'equipment' | 'weather' | 'other'
export type BuddyStatus = 'none' | 'invited' | 'paired' | 'auto_assigned' | 'expired'
export type TeamFormation = 'manual' | 'buddy_invite' | 'random'

export interface Competition {
  id: number
  name: string
  competition_date: string
  backup_date: string | null
  location_site: string | null
  boundaries_notes: string | null
  start_time: string | null
  finish_time: string | null
  sign_in_deadline: string | null
  weigh_in_start: string | null
  status: CompetitionStatus
  visibility: CompetitionVisibility
  overdue_grace_minutes: number
  alert_slack_enabled: boolean
  alert_email_enabled: boolean
  alert_emails: string | null
  created_at: string
  updated_at: string
}

export interface CompetitionInput {
  name: string
  competition_date: string
  backup_date?: string | null
  location_site?: string | null
  boundaries_notes?: string | null
  start_time?: string | null
  finish_time?: string | null
  sign_in_deadline?: string | null
  weigh_in_start?: string | null
  status?: CompetitionStatus
  visibility?: CompetitionVisibility
  overdue_grace_minutes?: number
  alert_slack_enabled?: boolean
  alert_email_enabled?: boolean
  alert_emails?: string | null
}

// Deployment-level channel state + escalation cadence for overdue alerts.
export interface NotificationStatus {
  slack_configured: boolean
  email_configured: boolean
  realert_minutes: number
  sweep_interval_seconds: number
}

// Per-channel result of an admin "send test alert".
export interface TestAlertResult {
  slack: { enabled: boolean; configured: boolean; sent: boolean }
  email: { enabled: boolean; configured: boolean; recipients: string[]; sent: boolean }
}

export interface CompetitionTeam {
  id: number
  competition_id: number
  name: string
  intended_dive_area: string | null
  notes: string | null
  formation: TeamFormation
  member_count: number
  created_at: string
  updated_at: string
}

export interface CompetitionTeamInput {
  name: string
  intended_dive_area?: string | null
  notes?: string | null
}

export interface Competitor {
  id: number
  competition_id: number
  team_id: number | null
  team_name: string | null
  intended_dive_area: string | null
  full_name: string
  phone: string | null
  email: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  vehicle_reg: string | null
  experience_level: ExperienceLevel | null
  float_colour: string | null
  medical_notes: string | null
  paid: boolean
  waiver_accepted: boolean
  notes: string | null
  status: CompetitorStatus
  buddy_status: BuddyStatus
  buddy_invite_email: string | null
  self_registered: boolean
  signed_out_at: string | null
  returned_at: string | null
  minutes_overdue: number
  is_overdue: boolean
  overdue_alerted_at: string | null
  has_team: boolean
  created_at: string
  updated_at: string
}

// ── Self-service registration (logged-in divers; /competition) ──────────────

export interface OpenCompetition {
  id: number
  name: string
  competition_date: string
  location_site: string | null
  boundaries_notes: string | null
  start_time: string | null
  finish_time: string | null
  sign_in_deadline: string | null
  status: CompetitionStatus
  registration_open: boolean
  already_registered: boolean
}

// A registrant's day-view of a competition they're in: public info + their own
// live water status (from GET /competition/mine). Shown once sign-ups close so
// a diver keeps sight of their event through the live day.
export interface MyCompetition {
  id: number
  name: string
  competition_date: string
  location_site: string | null
  boundaries_notes: string | null
  start_time: string | null
  finish_time: string | null
  sign_in_deadline: string | null
  status: CompetitionStatus
  registration_open: boolean
  already_registered: boolean
  my_status: CompetitorStatus
  my_registration_id: number
  signed_out_at: string | null
  returned_at: string | null
  is_live: boolean
}

export interface MyRegistration {
  id: number
  competition_id: number
  full_name: string
  phone: string | null
  email: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  vehicle_reg: string | null
  experience_level: ExperienceLevel | null
  float_colour: string | null
  medical_notes: string | null
  waiver_accepted: boolean
  paid: boolean
  status: CompetitorStatus
  buddy_status: BuddyStatus
  buddy_invite_email: string | null
  buddy_name: string | null
  has_buddy: boolean
  created_at: string
  updated_at: string
}

export interface RegistrationInput {
  full_name: string
  phone?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  vehicle_reg?: string | null
  experience_level?: ExperienceLevel | null
  float_colour?: string | null
  medical_notes?: string | null
  waiver_accepted?: boolean
  buddy_invite_email?: string | null
}

export interface AutoPairResult {
  teams_created: number
  competitors_paired: number
  leftover_solo_id: number | null
}

export interface CompetitorInput {
  full_name: string
  phone?: string | null
  email?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  vehicle_reg?: string | null
  experience_level?: ExperienceLevel | null
  float_colour?: string | null
  medical_notes?: string | null
  paid?: boolean
  waiver_accepted?: boolean
  notes?: string | null
  team_id?: number | null
  status?: CompetitorStatus
}

export interface BoardCounts {
  total: number
  not_arrived: number
  registered: number
  in_water: number
  returned: number
  late: number
  withdrawn: number
  overdue: number
  no_team: number
}

export interface WaterStatusBoard {
  competition: Competition
  counts: BoardCounts
  items: Competitor[]
}

export interface FishEntry {
  id: number
  competition_id: number
  competitor_id: number
  competitor_name: string | null
  team_id: number | null
  species: string
  // Null when the fish has been tallied as caught but not yet weighed.
  weight_grams: number | null
  weight_kg: number | null
  pending: boolean
  length_cm: number | null
  entered_at: string
  judge_initials: string | null
  notes: string | null
  disqualified: boolean
  disqualification_reason: string | null
  points_override: number | null
  created_at: string
  updated_at: string
}

export interface FishEntryInput {
  competitor_id: number
  species: string
  // Omit/null to record a pending catch; a weight can be added later.
  weight_grams?: number | null
  length_cm?: number | null
  judge_initials?: string | null
  notes?: string | null
  disqualified?: boolean
  disqualification_reason?: string | null
  points_override?: number | null
}

export interface CompetitionIncident {
  id: number
  competition_id: number
  competitor_id: number | null
  team_id: number | null
  incident_type: IncidentType
  occurred_at: string
  notes: string | null
  resolved: boolean
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface IncidentInput {
  incident_type: IncidentType
  competitor_id?: number | null
  team_id?: number | null
  occurred_at?: string | null
  notes?: string | null
  resolved?: boolean
  resolution_notes?: string | null
}

export interface ScoringRule {
  id: number
  competition_id: number
  points_per_gram: number
  species_bonus: Record<string, number>
  use_team_scoring: boolean
  updated_at: string
}

export interface ScoringRuleInput {
  points_per_gram?: number
  species_bonus?: Record<string, number>
  use_team_scoring?: boolean
}

export interface IndividualResult {
  rank: number
  competitor_id: number
  competitor_name: string
  team_id: number | null
  team_name: string | null
  points: number
  total_weight_grams: number
  total_weight_kg: number
  fish_count: number
  species_count: number
}

export interface TeamResult {
  rank: number
  team_id: number
  team_name: string
  points: number
  total_weight_grams: number
  total_weight_kg: number
  fish_count: number
  member_count: number
}

export interface BiggestFish {
  fish_id: number
  competitor_id: number
  competitor_name: string | null
  species: string
  weight_grams: number
  weight_kg: number
  length_cm: number | null
}

export interface CompetitionResults {
  competition: Competition
  scoring_rule: ScoringRule
  individual: IndividualResult[]
  teams: TeamResult[]
  biggest_fish: BiggestFish | null
  biggest_by_species: (BiggestFish & { species: string })[]
  species_count: { species: string; count: number }[]
  species_hunter: { competitor_id: number; competitor_name: string; species_count: number } | null
  totals: {
    total_fish: number
    weighed_fish: number
    pending_fish: number
    total_weight_grams: number
    total_weight_kg: number
    disqualified: number
    competitors: number
  }
}
