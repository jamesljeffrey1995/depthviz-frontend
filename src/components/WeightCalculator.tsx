import { useMemo, useState } from 'react'
import {
  calculateWeight,
  kgToLb,
  SUIT_REGIONS,
  type Build,
  type SuitRegions,
  type WaterType,
} from '../lib/weightCalc'
import { formatDepth } from '../lib/units'
import { BodySuitSelector } from './BodySuitSelector'
import { Badge, Card, PageLayout, SegmentedControl } from './ui'
import styles from './WeightCalculator.module.css'

interface Props {
  onNavigateLegal?: (page: string) => void
}

type UnitSystem = 'metric' | 'imperial'

const LB_TO_KG = 0.45359237
const IN_TO_CM = 2.54

const BUILD_OPTIONS: { value: Build; label: string; hint: string }[] = [
  { value: 'muscular', label: 'Muscular / low fat', hint: 'Dense, athletic, sinks easily' },
  { value: 'lean', label: 'Lean / athletic', hint: 'Toned, close to neutral' },
  { value: 'average', label: 'Average', hint: 'Typical build' },
  { value: 'stocky', label: 'Stocky / higher body fat', hint: 'More naturally buoyant' },
]

const REGION_SHORT: Record<'hood' | 'body' | 'legs', string> = {
  hood: 'Hood',
  body: 'Body',
  legs: 'Legs',
}

function describeSuit(regions: SuitRegions): string {
  const covered = SUIT_REGIONS.filter(r => (regions[r] ?? 0) > 0)
  if (covered.length === 0) return 'No wetsuit'
  return `${covered.map(r => `${REGION_SHORT[r]} ${regions[r]} mm`).join(' · ')}`
}

const HEIGHT_RANGE_CM = { min: 120, max: 220 }
const WEIGHT_RANGE_KG = { min: 35, max: 180 }
const WATER_LABEL: Record<WaterType, string> = { salt: 'Salt water', fresh: 'Fresh water' }

export function WeightCalculator({ onNavigateLegal }: Props) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  const [heightCm, setHeightCm] = useState(178)
  const [weightKg, setWeightKg] = useState(80)
  const [build, setBuild] = useState<Build>('average')
  const [regions, setRegions] = useState<SuitRegions>({ hood: 0, body: 5, legs: 5 })
  const [neutralDepthM, setNeutralDepthM] = useState(10)
  const [water, setWater] = useState<WaterType>('salt')

  const result = useMemo(
    () => calculateWeight({ heightCm, weightKg, build, regions, neutralDepthM, water }),
    [heightCm, weightKg, build, regions, neutralDepthM, water],
  )

  const imperial = unitSystem === 'imperial'
  const fmt = (kg: number) => (imperial ? `${kgToLb(kg).toFixed(1)} lb` : `${kg.toFixed(1)} kg`)
  const fmtDepth = (metres: number) => formatDepth(metres, imperial ? 'ft' : 'm')

  const heightInvalid = heightCm < HEIGHT_RANGE_CM.min || heightCm > HEIGHT_RANGE_CM.max
  const weightInvalid = weightKg < WEIGHT_RANGE_KG.min || weightKg > WEIGHT_RANGE_KG.max
  const rangeHint = (r: { min: number; max: number }, unit: 'cm' | 'kg') =>
    imperial
      ? unit === 'cm'
        ? `${Math.round(r.min / IN_TO_CM)}–${Math.round(r.max / IN_TO_CM)} in`
        : `${Math.round(r.min / LB_TO_KG)}–${Math.round(r.max / LB_TO_KG)} lb`
      : `${r.min}–${r.max} ${unit}`
  const inputsValid = !heightInvalid && !weightInvalid

  const suitLabel = describeSuit(regions)
  const buildLabel = BUILD_OPTIONS.find(o => o.value === build)?.label ?? build

  return (
    <PageLayout
      title="Weight belt calculator"
      subtitle="Freediving and spearfishing neutral-buoyancy estimate with safety guidance kept front and centre."
    >
      <Card className={styles.safety} padding="md" accent="var(--ds-warn)" role="note">
        <strong>Estimate only — not a safety device.</strong> This is a starting point to save you trial-and-error.
        You <em>must</em> confirm your weighting with an in-water buoyancy check in shallow water, and never freedive alone.{' '}
        {onNavigateLegal && (
          <button type="button" className={styles.inlineLink} onClick={() => onNavigateLegal('disclaimer')}>
            Read the full disclaimer
          </button>
        )}
      </Card>

      <Card className={styles.formCard} padding="lg">
        <div className={styles.fieldGroup}>
          <div className={styles.controlRow}>
            <div className={styles.controlBlock}>
              <span className={styles.groupLabel}>Display units</span>
              <SegmentedControl
                ariaLabel="Unit system"
                size="sm"
                value={unitSystem}
                onChange={setUnitSystem}
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>1 · Diver</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-height">Height {imperial ? '(in)' : '(cm)'}</label>
              <input
                id="wc-height"
                className={styles.input}
                type="number"
                inputMode="decimal"
                aria-invalid={heightInvalid || undefined}
                aria-describedby={heightInvalid ? 'wc-height-err' : undefined}
                value={imperial ? +(heightCm / IN_TO_CM).toFixed(1) : Math.round(heightCm)}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  if (Number.isNaN(v)) return
                  setHeightCm(imperial ? v * IN_TO_CM : v)
                }}
              />
              {heightInvalid && <p id="wc-height-err" className={styles.fieldError}>Enter a height between {rangeHint(HEIGHT_RANGE_CM, 'cm')}.</p>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-weight">Body weight {imperial ? '(lb)' : '(kg)'}</label>
              <input
                id="wc-weight"
                className={styles.input}
                type="number"
                inputMode="decimal"
                aria-invalid={weightInvalid || undefined}
                aria-describedby={weightInvalid ? 'wc-weight-err' : undefined}
                value={imperial ? +(weightKg / LB_TO_KG).toFixed(1) : Math.round(weightKg)}
                onChange={e => {
                  const v = e.target.valueAsNumber
                  if (Number.isNaN(v)) return
                  setWeightKg(imperial ? v * LB_TO_KG : v)
                }}
              />
              {weightInvalid && <p id="wc-weight-err" className={styles.fieldError}>Enter a body weight between {rangeHint(WEIGHT_RANGE_KG, 'kg')}.</p>}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="wc-build">Build / body composition</label>
            <select id="wc-build" className={styles.select} value={build} onChange={e => setBuild(e.target.value as Build)}>
              {BUILD_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label} — {option.hint}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>2 · Suit</div>

          <div className={styles.field}>
            <span className={styles.label}>Wetsuit thickness by body part</span>
            <BodySuitSelector value={regions} onChange={setRegions} />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>3 · Water</div>
          <div className={styles.controlBlock}>
            <SegmentedControl<WaterType>
              ariaLabel="Water type"
              size="sm"
              value={water}
              onChange={setWater}
              options={[
                { value: 'salt', label: 'Salt water' },
                { value: 'fresh', label: 'Fresh water' },
              ]}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>4 · Target depth</div>
          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label} htmlFor="wc-depth">Target neutral depth</label>
              <span className={styles.sliderValue}>{fmtDepth(neutralDepthM)}</span>
            </div>
            <input
              id="wc-depth"
              className={styles.slider}
              type="range"
              min={0}
              max={30}
              step={1}
              value={neutralDepthM}
              aria-valuetext={fmtDepth(neutralDepthM)}
              onChange={e => setNeutralDepthM(Number(e.target.value))}
            />
            <div className={styles.sliderHint}>
              Most freedivers weight to be neutral at {imperial ? '26–39 ft' : '8–12 m'} so they remain positively buoyant at the surface.
            </div>
          </div>
        </div>
      </Card>

      <Card className={styles.resultCard} padding="lg" accent="var(--ds-accent)" aria-live="polite">
        <div className={styles.resultLabel}>5 · Suggested starting weight</div>
        {inputsValid ? (
          <>
            <div className={styles.resultValue}>{fmt(result.recommendedKg)}</div>
            <div className={styles.resultRange}>Try {fmt(result.minKg)}–{fmt(result.maxKg)} and fine-tune in shallow water.</div>
            <p className={styles.resultExplain}>
              With this weight you should float at the surface after a relaxed breath and become neutral around {fmtDepth(neutralDepthM)}.
            </p>
            <div className={styles.breakdown}>
              <div className={styles.breakdownRow}><span>Wetsuit buoyancy (surface)</span><span>{fmt(result.suitBuoyancySurface)}</span></div>
              <div className={styles.breakdownRow}><span>Wetsuit buoyancy at {fmtDepth(neutralDepthM)}</span><span>{fmt(result.suitBuoyancyAtDepth)}</span></div>
              <div className={styles.breakdownRow}><span>Body buoyancy at {fmtDepth(neutralDepthM)}</span><span>{fmt(result.bodyBuoyancyAtDepth)}</span></div>
            </div>
            <div className={styles.resultAssumptions} aria-label="Based on your inputs">
              <Badge tone="neutral">{suitLabel}</Badge>
              <Badge tone="neutral">{buildLabel}</Badge>
              <Badge tone="neutral">{WATER_LABEL[water]}</Badge>
              <Badge tone="accent">Neutral at {fmtDepth(neutralDepthM)}</Badge>
            </div>
          </>
        ) : (
          <p className={styles.resultInvalid}>Check the highlighted fields above — the estimate only makes sense for realistic height and body-weight values.</p>
        )}
      </Card>

      <Card className={styles.howto} padding="lg">
        <h2>How to check it in the water</h2>
        <ol>
          <li>Enter shallow water with a buddy and your belt.</li>
          <li>Take a normal breath, stay still, and confirm you still float comfortably at the surface.</li>
          <li>You should only start to sink once you exhale or duck-dive past {imperial ? 'several feet' : 'a few metres'}.</li>
          <li>Add or remove weight {imperial ? '1.1 lb' : '0.5 kg'} at a time until you are positive at the surface and neutral near your target depth.</li>
        </ol>
        <p className={styles.howtoNote}>
          Always err on the side of <strong>less</strong> weight — being too heavy is a major contributor to shallow-water blackout fatalities.
        </p>
      </Card>

      <p className={styles.assumptions}>
        Assumes a relaxed breath and an even neoprene fit. Real buoyancy varies with suit age and compression, lung volume, equipment, and individual physiology.
      </p>
    </PageLayout>
  )
}
