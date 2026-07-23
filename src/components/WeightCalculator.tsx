import { useMemo, useState } from 'react'
import {
  calculateWeight,
  kgToLb,
  type Build,
  type SuitType,
  type WaterType,
} from '../lib/weightCalc'
import styles from './WeightCalculator.module.css'

interface Props {
  /** Navigate to a legal page (e.g. the full liability disclaimer). */
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

const SUIT_OPTIONS: { value: SuitType; label: string }[] = [
  { value: 'none', label: 'No wetsuit' },
  { value: 'shorty', label: 'Shorty' },
  { value: 'full', label: 'Full suit' },
  { value: 'fullHood', label: 'Full suit + hood' },
]

const THICKNESS_OPTIONS = [1.5, 2, 3, 5, 7, 8]

export function WeightCalculator({ onNavigateLegal }: Props) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric')
  // Stored internally in metric; the form converts for display.
  const [heightCm, setHeightCm] = useState(178)
  const [weightKg, setWeightKg] = useState(80)
  const [build, setBuild] = useState<Build>('average')
  const [suitType, setSuitType] = useState<SuitType>('full')
  const [wetsuitMm, setWetsuitMm] = useState(5)
  const [neutralDepthM, setNeutralDepthM] = useState(10)
  const [water, setWater] = useState<WaterType>('salt')

  const result = useMemo(
    () =>
      calculateWeight({ heightCm, weightKg, build, wetsuitMm, suitType, neutralDepthM, water }),
    [heightCm, weightKg, build, wetsuitMm, suitType, neutralDepthM, water],
  )

  const imperial = unitSystem === 'imperial'
  const fmt = (kg: number) => (imperial ? `${kgToLb(kg).toFixed(1)} lb` : `${kg.toFixed(1)} kg`)

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Weight Belt Calculator</div>
      <div className={styles.subtitle}>Freediving &amp; spearfishing · neutral-buoyancy estimate</div>

      {/* Safety notice sits ABOVE the result so it is never missed. */}
      <div className={styles.safety} role="note">
        <strong>Estimate only — not a safety device.</strong> This is a starting point to
        save you trial-and-error. You <em>must</em> confirm your weighting with an in-water
        buoyancy check in shallow water, and never freedive alone.{' '}
        {onNavigateLegal && (
          <button type="button" className={styles.inlineLink} onClick={() => onNavigateLegal('disclaimer')}>
            Read the full disclaimer
          </button>
        )}
      </div>

      <div className={styles.card}>
        {/* Unit system toggle */}
        <div className={styles.unitToggle} role="group" aria-label="Unit system">
          <button
            type="button"
            className={`${styles.unitBtn} ${!imperial ? styles.unitActive : ''}`}
            onClick={() => setUnitSystem('metric')}
            aria-pressed={!imperial}
          >
            Metric (kg / cm)
          </button>
          <button
            type="button"
            className={`${styles.unitBtn} ${imperial ? styles.unitActive : ''}`}
            onClick={() => setUnitSystem('imperial')}
            aria-pressed={imperial}
          >
            Imperial (lb / in)
          </button>
        </div>

        {/* Diver info — the physical inputs the estimate is built from */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>Diver</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-height">
                Height {imperial ? '(in)' : '(cm)'}
              </label>
              <input
                id="wc-height"
                className={styles.input}
                type="number"
                inputMode="decimal"
                value={imperial ? +(heightCm / IN_TO_CM).toFixed(1) : Math.round(heightCm)}
                onChange={e => {
                  // Ignore empty/partial input (NaN) so clearing the field doesn't snap to 0.
                  const v = e.target.valueAsNumber
                  if (Number.isNaN(v)) return
                  setHeightCm(imperial ? v * IN_TO_CM : v)
                }}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-weight">
                Body weight {imperial ? '(lb)' : '(kg)'}
              </label>
              <input
                id="wc-weight"
                className={styles.input}
                type="number"
                inputMode="decimal"
                value={imperial ? +(weightKg / LB_TO_KG).toFixed(1) : Math.round(weightKg)}
                onChange={e => {
                  // Ignore empty/partial input (NaN) so clearing the field doesn't snap to 0.
                  const v = e.target.valueAsNumber
                  if (Number.isNaN(v)) return
                  setWeightKg(imperial ? v * LB_TO_KG : v)
                }}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="wc-build">Build / body composition</label>
            <select
              id="wc-build"
              className={styles.select}
              value={build}
              onChange={e => setBuild(e.target.value as Build)}
            >
              {BUILD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment & target — what you'll wear and where you want to hang neutral */}
        <div className={styles.fieldGroup}>
          <div className={styles.groupLabel}>Equipment &amp; target</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-suit">Wetsuit type</label>
              <select
                id="wc-suit"
                className={styles.select}
                value={suitType}
                onChange={e => setSuitType(e.target.value as SuitType)}
              >
                {SUIT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wc-thickness">Neoprene thickness</label>
              <select
                id="wc-thickness"
                className={styles.select}
                value={wetsuitMm}
                disabled={suitType === 'none'}
                onChange={e => setWetsuitMm(Number(e.target.value))}
              >
                {THICKNESS_OPTIONS.map(t => (
                  <option key={t} value={t}>{t} mm</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.sliderHeader}>
              <label className={styles.label} htmlFor="wc-depth">Target neutral depth</label>
              <span className={styles.sliderValue}>{neutralDepthM} m</span>
            </div>
            <input
              id="wc-depth"
              className={styles.slider}
              type="range"
              min={0}
              max={30}
              step={1}
              value={neutralDepthM}
              onChange={e => setNeutralDepthM(Number(e.target.value))}
            />
            <div className={styles.sliderHint}>
              The depth where you want to stop sinking/floating and hover. Most freedivers weight
              to be neutral at 8–12&nbsp;m so they float positively at the surface.
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Water type</label>
            <div className={styles.segmented} role="group" aria-label="Water type">
              <button
                type="button"
                className={`${styles.segBtn} ${water === 'salt' ? styles.segActive : ''}`}
                onClick={() => setWater('salt')}
                aria-pressed={water === 'salt'}
              >
                Salt water
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${water === 'fresh' ? styles.segActive : ''}`}
                onClick={() => setWater('fresh')}
                aria-pressed={water === 'fresh'}
              >
                Fresh water
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className={styles.resultCard} aria-live="polite">
        <div className={styles.resultLabel}>Suggested starting weight</div>
        <div className={styles.resultValue}>{fmt(result.recommendedKg)}</div>
        <div className={styles.resultRange}>
          Try {fmt(result.minKg)}–{fmt(result.maxKg)} and fine-tune in the water
        </div>

        <div className={styles.breakdown}>
          <div className={styles.breakdownRow}>
            <span>Wetsuit buoyancy (surface)</span>
            <span>{fmt(result.suitBuoyancySurface)}</span>
          </div>
          <div className={styles.breakdownRow}>
            <span>Wetsuit buoyancy at {neutralDepthM} m</span>
            <span>{fmt(result.suitBuoyancyAtDepth)}</span>
          </div>
          <div className={styles.breakdownRow}>
            <span>Body buoyancy at {neutralDepthM} m</span>
            <span>{fmt(result.bodyBuoyancyAtDepth)}</span>
          </div>
        </div>
      </div>

      {/* How to verify */}
      <div className={styles.howto}>
        <h3>How to check it in the water</h3>
        <ol>
          <li>Enter shallow water (chest-deep or a pool) with a buddy and your belt.</li>
          <li>Take a normal breath (not a full max inhale) and stay still.</li>
          <li>You should float at the surface and only start to sink once you exhale or
            duck-dive past a few metres.</li>
          <li>Add or remove weight 0.5&nbsp;kg at a time until you are comfortably positive
            at the surface and neutral around your target depth.</li>
        </ol>
        <p className={styles.howtoNote}>
          Always err on the side of <strong>less</strong> weight — being too heavy is the
          leading contributor to shallow-water blackout fatalities. Use a quick-release
          weight belt and dive with a trained buddy using one-up-one-down.
        </p>
      </div>

      <div className={styles.assumptions}>
        Assumes a relaxed breath and an even neoprene fit. Real buoyancy varies with suit age
        and compression, lung volume, equipment (fins, mask, float), and individual physiology.
        Treat the number as a ballpark, not a prescription.
      </div>
    </div>
  )
}
