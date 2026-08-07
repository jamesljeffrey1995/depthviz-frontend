import type {
  KnnBiasResult,
  BestVisResponse,
  DayForecast,
  ForecastResponse,
  Location,
  ReportRead,
  SimilarReport,
  UserProfile,
  VisibilityFactor,
  SwellComponent,
  AlgaeRisk,
} from '../types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function asNullableNumber(value: unknown): number | null {
  return value == null ? null : asNumber(value)
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value)
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function normalizeSwellComponents(value: unknown): SwellComponent[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      const rec = asRecord(item)
      if (!rec) return null
      const type = rec.type === 'primary' || rec.type === 'secondary' || rec.type === 'wind_wave' ? rec.type : 'primary'
      const label = asString(rec.label) ?? ''
      const height = asNumber(rec.height) ?? 0
      const direction = asNullableNumber(rec.direction)
      const dir_label = asString(rec.dir_label)
      return { type, label, height, direction, dir_label }
    })
    .filter((v): v is SwellComponent => !!v)
}

function normalizeFactors(value: unknown): VisibilityFactor[] {
  if (!Array.isArray(value)) return []
  const out: VisibilityFactor[] = []
  for (const item of value) {
    const rec = asRecord(item)
    if (!rec) continue
    const name = asString(rec.name)
    const textValue = asString(rec.value)
    if (!name || !textValue) continue
    out.push({
      name,
      value: textValue,
      note: asString(rec.note) ?? undefined,
      penalty: asNumber(rec.penalty) ?? 0,
      max_penalty: asNumber(rec.max_penalty) ?? 0,
    })
  }
  return out
}

function normalizeAlgae(value: unknown): AlgaeRisk {
  const rec = asRecord(value)
  const risk = rec?.risk === 'low' || rec?.risk === 'moderate' || rec?.risk === 'high' ? rec.risk : 'low'
  return {
    risk,
    score: asNumber(rec?.score) ?? 0,
    drivers: asStringArray(rec?.drivers),
  }
}

function normalizeResuspension(value: unknown): DayForecast['resuspension'] {
  const rec = asRecord(value)
  if (!rec) return null

  const resuspension_risk = asNumber(rec.resuspension_risk)
  const recovery_state = asNumber(rec.recovery_state)
  const risk_level = asString(rec.risk_level)
  const penalty = asNumber(rec.penalty)
  if (resuspension_risk == null || recovery_state == null || !risk_level || penalty == null) return null

  const seabed = rec.seabed_class
  const seabed_class = seabed === 'rock' || seabed === 'gravel' || seabed === 'sand' || seabed === 'mixed' || seabed === 'mud'
    ? seabed
    : null

  return {
    depth_m: asNullableNumber(rec.depth_m),
    bottom_orbital_velocity: asNullableNumber(rec.bottom_orbital_velocity),
    bed_shear_stress: asNullableNumber(rec.bed_shear_stress),
    seabed_class,
    critical_shear: asNullableNumber(rec.critical_shear),
    resuspension_risk,
    recovery_state,
    risk_level,
    penalty,
    note: asNullableString(rec.note),
  }
}

function normalizeRiverDischarge(value: unknown): DayForecast['river_discharge'] {
  const rec = asRecord(value)
  if (!rec) return null

  const risk_level = asString(rec.risk_level)
  const penalty = asNumber(rec.penalty)
  if (!risk_level || penalty == null) return null

  return {
    discharge_m3s: asNullableNumber(rec.discharge_m3s),
    discharge_mean: asNullableNumber(rec.discharge_mean),
    discharge_ratio: asNullableNumber(rec.discharge_ratio),
    risk_level,
    penalty,
    note: asNullableString(rec.note),
    distance_km: asNullableNumber(rec.distance_km),
  }
}

function normalizeWaterQuality(value: unknown): DayForecast['water_quality'] {
  const rec = asRecord(value)
  if (!rec) return null

  return {
    bgc_kd: asNullableNumber(rec.bgc_kd),
    bgc_kd_vis: asNullableNumber(rec.bgc_kd_vis),
    bgc_source: asNullableString(rec.bgc_source),
    erddap_chlorophyll: asNullableNumber(rec.erddap_chlorophyll),
    erddap_kd490: asNullableNumber(rec.erddap_kd490),
    erddap_kd490_vis: asNullableNumber(rec.erddap_kd490_vis),
    erddap_obs_date: asNullableString(rec.erddap_obs_date),
  }
}

function normalizeBiasAttribution(value: unknown): DayForecast['bias_attribution'] {
  const rec = asRecord(value)
  if (!rec || !Array.isArray(rec.similar_reports)) return null

  const mean_error = asNumber(rec.mean_error)
  const total_reports = asNumber(rec.total_reports)
  if (mean_error == null || total_reports == null) return null

  const similar_reports = rec.similar_reports
    .map(item => {
      const report = asRecord(item)
      if (!report) return null

      const date = asString(report.date)
      const actual_vis = asNumber(report.actual_vis)
      const model_predicted = asNumber(report.model_predicted)
      const error = asNumber(report.error)
      const conditions = asString(report.conditions)
      const similarity = asNumber(report.similarity)
      if (!date || actual_vis == null || model_predicted == null || error == null || !conditions || similarity == null) return null

      return {
        date,
        actual_vis,
        model_predicted,
        error,
        conditions,
        similarity,
      }
    })
    .filter((item): item is SimilarReport => !!item)

  const knnRec = asRecord(rec.knn)
  const knn = (() => {
    if (!knnRec) return null

    const bias = asNumber(knnRec.bias)
    const logs_used = asNumber(knnRec.logs_used)
    const logs_excluded = asNumber(knnRec.logs_excluded)
    const outliers_softened = asNumber(knnRec.outliers_softened)
    const confidence: KnnBiasResult['confidence'] | null = knnRec.confidence === 'insufficient_data' || knnRec.confidence === 'low' || knnRec.confidence === 'medium' || knnRec.confidence === 'high'
      ? knnRec.confidence
      : null
    if (bias == null || logs_used == null || logs_excluded == null || outliers_softened == null || !confidence) return null

    return {
      bias,
      logs_used,
      logs_excluded,
      outliers_softened,
      confidence,
      mean_distance: asNullableNumber(knnRec.mean_distance),
    }
  })()

  return {
    similar_reports,
    mean_error,
    total_reports,
    knn,
  }
}

function normalizeExplanation(value: unknown): DayForecast['explanation'] {
  const rec = asRecord(value)
  if (!rec) return null

  const visibility_m = asNumber(rec.visibility_m)
  const confidence = rec.confidence === 'low' || rec.confidence === 'medium' || rec.confidence === 'high'
    ? rec.confidence
    : null
  const main_reason = asString(rec.main_reason)
  if (visibility_m == null || !confidence || !main_reason) return null

  return {
    visibility_m,
    confidence,
    main_reason,
    contributing_factors: asStringArray(rec.contributing_factors),
    satellite_signal: asNullableString(rec.satellite_signal),
    local_reports: asNullableString(rec.local_reports),
    model_agreement: asNullableString(rec.model_agreement),
    agreement_score: asNullableNumber(rec.agreement_score),
  }
}

function normalizeDayForecast(value: unknown): DayForecast | null {
  const rec = asRecord(value)
  if (!rec) return null

  const date = asString(rec.date)
  const vis_estimate = asNumber(rec.vis_estimate)
  const verdict = asString(rec.verdict)
  const color_class = asString(rec.color_class)
  if (!date || vis_estimate == null || !verdict || !color_class) return null

  return {
    date,
    is_forecast: asBoolean(rec.is_forecast) ?? true,
    vis_estimate,
    vis_corrected: asNullableNumber(rec.vis_corrected),
    vis_corrected_offset: asNullableNumber(rec.vis_corrected_offset),
    verdict,
    color_class,
    wave_height: asNumber(rec.wave_height) ?? 0,
    swell_height: asNumber(rec.swell_height) ?? 0,
    swell_period: asNullableNumber(rec.swell_period),
    swell_direction: asNullableNumber(rec.swell_direction),
    swell_dir_label: asString(rec.swell_dir_label),
    swell_components: normalizeSwellComponents(rec.swell_components),
    wind_speed: asNumber(rec.wind_speed) ?? 0,
    wind_dir: asNumber(rec.wind_dir) ?? 0,
    wind_dir_label: asString(rec.wind_dir_label) ?? 'N',
    wind_gust: asNullableNumber(rec.wind_gust),
    precipitation: asNumber(rec.precipitation) ?? 0,
    air_temp: asNumber(rec.air_temp) ?? 0,
    sea_temp: asNullableNumber(rec.sea_temp),
    humidity: asNumber(rec.humidity) ?? 0,
    cloud_cover: asNullableNumber(rec.cloud_cover),
    algae: normalizeAlgae(rec.algae),
    factors: normalizeFactors(rec.factors),
    nutrient_factor: asNullableNumber(rec.nutrient_factor),
    turbidity_penalty: asNullableNumber(rec.turbidity_penalty),
    resuspension: normalizeResuspension(rec.resuspension),
    river_discharge: normalizeRiverDischarge(rec.river_discharge),
    water_quality: normalizeWaterQuality(rec.water_quality),
    bias_attribution: normalizeBiasAttribution(rec.bias_attribution),
    explanation: normalizeExplanation(rec.explanation),
  }
}

export function normalizeForecastResponse(value: unknown): ForecastResponse {
  const rec = asRecord(value)
  if (!rec) throw new Error('Invalid forecast response format')

  const location_name = asString(rec.location_name)
  const lat = asNumber(rec.lat)
  const lon = asNumber(rec.lon)
  if (!location_name || lat == null || lon == null) throw new Error('Invalid forecast response payload')

  const days = Array.isArray(rec.days) ? rec.days.map(normalizeDayForecast).filter((d): d is DayForecast => !!d) : []
  if (days.length === 0) throw new Error('Forecast response did not include usable forecast days')

  const model_confidence = rec.model_confidence === 'none' || rec.model_confidence === 'low' || rec.model_confidence === 'medium' || rec.model_confidence === 'high'
    ? rec.model_confidence
    : 'none'

  return {
    location_name,
    lat,
    lon,
    days,
    bias_offset: asNullableNumber(rec.bias_offset),
    global_bias_offset: asNullableNumber(rec.global_bias_offset),
    report_count: asNumber(rec.report_count) ?? 0,
    model_confidence,
    calibration_active: asBoolean(rec.calibration_active) ?? false,
    units: rec.units === 'ft' || rec.units === 'm' ? rec.units : undefined,
  }
}

export function normalizeLocation(value: unknown): Location {
  const rec = asRecord(value)
  if (!rec) throw new Error('Invalid location payload')

  const id = asNumber(rec.id)
  const name = asString(rec.name)
  const lat = asNumber(rec.lat)
  const lon = asNumber(rec.lon)
  if (id == null || !name || lat == null || lon == null) throw new Error('Invalid location payload')

  const seabed = rec.seabed_class
  const seabed_class = seabed === 'rock' || seabed === 'gravel' || seabed === 'sand' || seabed === 'mixed' || seabed === 'mud'
    ? seabed
    : null

  return {
    id,
    name,
    lat,
    lon,
    is_public: asBoolean(rec.is_public) ?? false,
    is_predefined: asBoolean(rec.is_predefined) ?? false,
    vote_count: asNumber(rec.vote_count) ?? 0,
    user_vote: rec.user_vote === 'up' || rec.user_vote === 'down' ? rec.user_vote : null,
    encrypted_lat: asString(rec.encrypted_lat),
    encrypted_lon: asString(rec.encrypted_lon),
    depth_m: asNullableNumber(rec.depth_m),
    seabed_class,
  }
}

export function normalizeLocations(value: unknown): Location[] {
  if (!Array.isArray(value)) throw new Error('Invalid locations response format')
  return value.map(normalizeLocation)
}

export function normalizeUserProfile(value: unknown): UserProfile {
  const rec = asRecord(value)
  if (!rec) throw new Error('Invalid profile payload')

  const supabase_uid = asString(rec.supabase_uid)
  const email = asString(rec.email)
  if (!supabase_uid || !email) throw new Error('Invalid profile payload')

  const level = rec.experience_level
  const experience_level = level === 'beginner' || level === 'intermediate' || level === 'experienced' ? level : null

  return {
    supabase_uid,
    email,
    display_name: asString(rec.display_name),
    phone: asString(rec.phone),
    emergency_contact_name: asString(rec.emergency_contact_name),
    emergency_contact_phone: asString(rec.emergency_contact_phone),
    vehicle_reg: asString(rec.vehicle_reg),
    experience_level,
    float_colour: asString(rec.float_colour),
    medical_notes: asString(rec.medical_notes),
    report_count: asNumber(rec.report_count) ?? 0,
    mean_accuracy: asNullableNumber(rec.mean_accuracy),
    trusted: asBoolean(rec.trusted) ?? false,
    is_admin: asBoolean(rec.is_admin) ?? false,
  }
}

function normalizeReport(value: unknown): ReportRead {
  const rec = asRecord(value)
  if (!rec) throw new Error('Invalid report payload')

  const id = asNumber(rec.id)
  const user_id = asString(rec.user_id)
  const location_id = asNumber(rec.location_id)
  const report_date = asString(rec.report_date)
  const actual_vis = asNumber(rec.actual_vis)
  const predicted_vis = asNumber(rec.predicted_vis)
  const created_at = asString(rec.created_at)
  if (id == null || !user_id || location_id == null || !report_date || actual_vis == null || predicted_vis == null || !created_at) {
    throw new Error('Invalid report payload')
  }

  return {
    id,
    user_id,
    location_id,
    report_date,
    actual_vis,
    predicted_vis,
    wave_height: asNumber(rec.wave_height) ?? undefined,
    swell_height: asNumber(rec.swell_height) ?? undefined,
    wind_speed: asNumber(rec.wind_speed) ?? undefined,
    wind_dir: asNumber(rec.wind_dir) ?? undefined,
    precipitation: asNumber(rec.precipitation) ?? undefined,
    air_temp: asNumber(rec.air_temp) ?? undefined,
    sea_temp: asNullableNumber(rec.sea_temp),
    algae_risk: asString(rec.algae_risk) ?? undefined,
    notes: asString(rec.notes) ?? undefined,
    chlorophyll: asNullableNumber(rec.chlorophyll),
    kd490: asNullableNumber(rec.kd490),
    video_vis_median: asNumber(rec.video_vis_median) ?? undefined,
    video_vis_p10: asNumber(rec.video_vis_p10) ?? undefined,
    video_vis_p90: asNumber(rec.video_vis_p90) ?? undefined,
    video_t_median: asNumber(rec.video_t_median) ?? undefined,
    video_frame_count: asNumber(rec.video_frame_count) ?? undefined,
    trust_weight: asNumber(rec.trust_weight) ?? 0,
    is_quarantined: asBoolean(rec.is_quarantined) ?? false,
    created_at,
  }
}

export function normalizeReportList(value: unknown): ReportRead[] {
  if (!Array.isArray(value)) throw new Error('Invalid reports response format')
  return value.map(normalizeReport)
}

export function normalizeBestVisResponse(value: unknown): BestVisResponse {
  const rec = asRecord(value)
  if (!rec || !Array.isArray(rec.spots)) throw new Error('Invalid best-visibility response format')

  const spots = rec.spots
    .map(item => {
      const itemRec = asRecord(item)
      if (!itemRec) return null
      const name = asString(itemRec.name)
      const lat = asNumber(itemRec.lat)
      const lon = asNumber(itemRec.lon)
      const day = normalizeDayForecast(itemRec.day)
      if (!name || lat == null || lon == null || !day) return null
      return { name, lat, lon, day }
    })
    .filter((spot): spot is BestVisResponse['spots'][number] => !!spot)

  return {
    spots,
    failedCount: asNumber(rec.failedCount) ?? undefined,
  }
}
