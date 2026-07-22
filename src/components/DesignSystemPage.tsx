import { useState, type CSSProperties } from 'react'
import type { DayForecast } from '../types'
import {
  Card, Button, Badge, SectionHeader, Meter, StatTile, DiveScore,
  SegmentedControl, Skeleton, DiveScoreSkeleton,
  EyeIcon, WaveIcon, WindIcon, RainIcon, ThermometerIcon, CompassIcon, CheckIcon, AlertIcon,
} from './ui'
import { DiveScoreCard } from './DiveScoreCard'
import styles from './DesignSystemPage.module.css'

/* A living style guide — the design system rendered from the very components
   the product ships, so the documentation can never drift from the code. */

const QUALITY = [
  { name: 'Excellent', token: '--ds-q-excellent', hex: '#7fffd4' },
  { name: 'Good', token: '--ds-q-good', hex: '#1ca3ec' },
  { name: 'Workable', token: '--ds-q-workable', hex: '#2e8b99' },
  { name: 'Marginal', token: '--ds-q-marginal', hex: '#2e7c8c' },
  { name: 'Poor', token: '--ds-q-poor', hex: '#35586f' },
  { name: 'Blown out', token: '--ds-q-blown', hex: '#31556b' },
]

const NEUTRALS = ['950', '900', '850', '800', '700', '600', '500', '400', '300', '200', '100', '050']

const TYPE_SPECS = [
  { role: 'Hero', cls: styles.tHero, spec: '48 / 700 · -0.02em', sample: 'Should I dive?' },
  { role: 'Section heading', cls: styles.tH2, spec: '24 / 700', sample: 'Environmental breakdown' },
  { role: 'Card title', cls: styles.tH3, spec: '20 / 600', sample: 'Best upcoming window' },
  { role: 'Body', cls: styles.tBody, spec: '15 / 400 · 1.55', sample: 'Calm seas and clear water are carrying the score today.' },
  { role: 'Metadata', cls: styles.tMeta, spec: '13 / 500', sample: '4 diver reports · updated 20 min ago' },
  { role: 'Label', cls: styles.tLabel, spec: '12 / 600 · uppercase', sample: 'Visibility' },
  { role: 'Mono readout', cls: styles.tMono, spec: 'IBM Plex Mono · 13 / 500', sample: '55.9042° N, 2.1318° W · buoy 62145' },
]

function mockDay(overrides: Partial<DayForecast>): DayForecast {
  return {
    date: new Date().toISOString().slice(0, 10),
    is_forecast: true, vis_estimate: 5.2, vis_corrected: null, vis_corrected_offset: null,
    verdict: 'good', color_class: 'good', wave_height: 0.4, swell_height: 0.5, swell_period: 7,
    swell_direction: 45, swell_dir_label: 'NE', swell_components: [], wind_speed: 8, wind_dir: 200,
    wind_dir_label: 'SSW', wind_gust: null, precipitation: 0.1, air_temp: 16, sea_temp: 14, humidity: 68,
    cloud_cover: 30, algae: { risk: 'low', score: 0.1, drivers: [] } as DayForecast['algae'],
    factors: [], nutrient_factor: null, turbidity_penalty: null, resuspension: null,
    river_discharge: null, water_quality: null, bias_attribution: null, explanation: null,
    ...overrides,
  }
}

const goodDay = mockDay({ vis_estimate: 6.1, wave_height: 0.3, swell_height: 0.4, wind_speed: 6 })
const poorDay = mockDay({ vis_estimate: 1.4, wave_height: 1.8, swell_height: 2.1, wind_speed: 24, precipitation: 3, algae: { risk: 'high', score: 0.8, drivers: ['River runoff'] } as DayForecast['algae'] })

export function DesignSystemPage() {
  const [seg, setSeg] = useState<'m' | 'ft'>('m')
  const [loading, setLoading] = useState(false)

  return (
    <div className={`${styles.page} dv-reveal`}>
      <header className={styles.masthead} style={{ '--i': 0 } as CSSProperties}>
        <div className={styles.eyebrow}>DepthViz Design System</div>
        <h1 className={styles.title}>Clarity, confidence, rapid decisions.</h1>
        <p className={styles.lede}>
          A deep, ocean-inspired system built to answer one question on every screen:
          <strong> should I dive here today?</strong> These are the live components the product ships,
          revealed in the same staggered page load the app uses.
        </p>
      </header>

      {/* Colour */}
      <section className={styles.section} id="colour" style={{ '--i': 1 } as CSSProperties}>
        <SectionHeader eyebrow="Tokens" title="Dive quality scale" subtitle="A water-clarity ramp, not a red–amber–green traffic light: murky water reads as darker, subdued tones and clear water as brighter aqua. Six luminance-stepped hues, each always paired with a label or glyph, never colour alone." />
        <div className={styles.swatchRow}>
          {QUALITY.map(q => (
            <div key={q.name} className={styles.swatch}>
              <span className={styles.swatchChip} style={{ background: q.hex }} />
              <span className={styles.swatchName}>{q.name}</span>
              <span className={styles.swatchToken}>{q.token}</span>
            </div>
          ))}
        </div>
        <SectionHeader title="Ink ramp & accent" as="h3" />
        <div className={styles.rampRow}>
          {NEUTRALS.map(n => (
            <span key={n} className={styles.rampChip} style={{ background: `var(--ds-ink-${n})` }} title={`--ds-ink-${n}`} />
          ))}
          <span className={styles.rampChip} style={{ background: 'var(--ds-ocean-400)' }} title="--ds-ocean-400" />
          <span className={styles.rampChip} style={{ background: 'var(--ds-ocean-500)' }} title="--ds-ocean-500" />
        </div>
      </section>

      {/* Typography */}
      <section className={styles.section} id="type" style={{ '--i': 2 } as CSSProperties}>
        <SectionHeader eyebrow="Tokens" title="Typography" subtitle="Space Grotesk for the display voice, Inter for body and metrics, IBM Plex Mono for coordinates, buoy IDs and timestamps. Numbers use tabular figures for stable, scannable columns." />
        <Card padding="lg" className={styles.typeCard}>
          {TYPE_SPECS.map(t => (
            <div key={t.role} className={styles.typeRow}>
              <div className={styles.typeMeta}>
                <div className={styles.typeRole}>{t.role}</div>
                <div className={styles.typeSpec}>{t.spec}</div>
              </div>
              <div className={t.cls}>{t.sample}</div>
            </div>
          ))}
        </Card>
      </section>

      {/* Dive Score gauge */}
      <section className={styles.section} id="score" style={{ '--i': 3 } as CSSProperties}>
        <SectionHeader eyebrow="Signature component" title="Dive Quality Score" subtitle="The single, prominent number that leads every location page." />
        <div className={styles.gaugeRow}>
          <div className={styles.gaugeCell}><DiveScore score={91} color="#7fffd4" label="Excellent" /></div>
          <div className={styles.gaugeCell}><DiveScore score={72} color="#1ca3ec" label="Good" /></div>
          <div className={styles.gaugeCell}><DiveScore score={54} color="#2e8b99" label="Fair" /></div>
          <div className={styles.gaugeCell}><DiveScore score={36} color="#2e7c8c" label="Marginal" /></div>
          <div className={styles.gaugeCell}><DiveScore score={12} color="#35586f" label="Poor" /></div>
        </div>
      </section>

      {/* Decision card */}
      <section className={styles.section} id="decision" style={{ '--i': 4 } as CSSProperties}>
        <SectionHeader eyebrow="Composition" title="Decision card" subtitle="Score + verdict + self-explaining factor breakdown + best-window shortcut." />
        <div className={styles.cardGrid}>
          <DiveScoreCard day={goodDay} locationName="St Abbs Head" units="m" forecast={{ report_count: 4, model_confidence: 'high' }} />
          <DiveScoreCard day={poorDay} locationName="Beadnell Bay" units="m" forecast={{ report_count: 1, model_confidence: 'low' }} />
        </div>
      </section>

      {/* Buttons & controls */}
      <section className={styles.section} id="controls" style={{ '--i': 5 } as CSSProperties}>
        <SectionHeader eyebrow="Library" title="Buttons & controls" subtitle="Pill buttons with a 44px minimum touch target at every size." />
        <div className={styles.inlineRow}>
          <Button variant="primary" iconStart={<CheckIcon />}>Save this spot</Button>
          <Button variant="secondary">Compare</Button>
          <Button variant="ghost">Advanced</Button>
          <Button variant="danger" iconStart={<AlertIcon />}>Report hazard</Button>
        </div>
        <div className={styles.inlineRow}>
          <SegmentedControl
            ariaLabel="Units"
            value={seg}
            onChange={setSeg}
            options={[{ value: 'm', label: 'Metres' }, { value: 'ft', label: 'Feet' }]}
          />
          <SegmentedControl
            ariaLabel="View"
            size="sm"
            value={seg === 'm' ? 'ft' : 'm'}
            onChange={() => {}}
            options={[{ value: 'm', label: 'Day' }, { value: 'ft', label: 'Week' }]}
          />
        </div>
      </section>

      {/* Badges */}
      <section className={styles.section} id="badges" style={{ '--i': 6 } as CSSProperties}>
        <SectionHeader eyebrow="Library" title="Badges & verdicts" />
        <div className={styles.inlineRow}>
          <Badge tone="success" dot>Yes, dive</Badge>
          <Badge tone="warn" dot>Maybe</Badge>
          <Badge tone="danger" dot>Not today</Badge>
          <Badge tone="accent" icon={<EyeIcon />}>High confidence</Badge>
          <Badge tone="neutral">Model forecast</Badge>
        </div>
      </section>

      {/* Meters + stat tiles */}
      <section className={styles.section} id="data" style={{ '--i': 7 } as CSSProperties}>
        <SectionHeader eyebrow="Library" title="Factor meters & stat tiles" subtitle="Each row is scannable in under two seconds and legible without colour." />
        <div className={styles.cardGrid}>
          <Card padding="lg" className={styles.stack}>
            <Meter label="Visibility" value="6.1 m" percent={87} color="var(--ds-success)" impact="positive" note="Clear enough to enjoy the ground" />
            <Meter label="Sea state" value="0.4 m" percent={90} color="var(--ds-success)" impact="positive" note="Calm — little sediment being stirred" />
            <Meter label="Wind" value="18 kn" percent={45} color="var(--ds-warn)" impact="neutral" note="Breezy — expect some chop" />
            <Meter label="Rainfall" value="3.0 mm/h" percent={20} color="var(--ds-danger)" impact="negative" note="Heavy rain — runoff clouds the shallows" />
          </Card>
          <Card padding="lg">
            <div className={styles.tileGrid}>
              <StatTile label="Sea temp" value="14.2" unit="°C" icon={<ThermometerIcon />} color="var(--ds-info)" sub="Wetsuit weather" />
              <StatTile label="Swell" value="0.5" unit="m" icon={<WaveIcon />} sub="7s NE" />
              <StatTile label="Wind" value="8" unit="kn" icon={<WindIcon />} sub="SSW" />
              <StatTile label="Swell dir" value="NE" icon={<CompassIcon />} sub="45°" />
              <StatTile label="Rain" value="0.1" unit="mm/h" icon={<RainIcon />} sub="Dry" />
              <StatTile label="Visibility" value="6.1" unit="m" icon={<EyeIcon />} color="var(--ds-success)" sub="Good" />
            </div>
          </Card>
        </div>
      </section>

      {/* Loading */}
      <section className={styles.section} id="loading" style={{ '--i': 8 } as CSSProperties}>
        <SectionHeader
          eyebrow="Perceived performance"
          title="Skeleton states"
          action={<Button variant="secondary" size="sm" onClick={() => setLoading(v => !v)}>{loading ? 'Show content' : 'Show skeleton'}</Button>}
        />
        {loading ? <DiveScoreSkeleton /> : (
          <Card padding="lg" className={styles.stack}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="40%" height={14} />
            <Skeleton height={12} />
          </Card>
        )}
      </section>
    </div>
  )
}
