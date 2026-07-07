import { useId, useState } from 'react'
import { SUIT_REGIONS, type SuitRegion, type SuitRegions } from '../lib/weightCalc'
import styles from './BodySuitSelector.module.css'

interface Props {
  /** Current per-region neoprene thickness (mm). */
  value: SuitRegions
  /** Called with the next region map whenever a thickness changes. */
  onChange: (next: SuitRegions) => void
}

/** Thickness choices offered per region — 0 means bare skin there. */
const THICKNESS_CHOICES = [0, 1.5, 2, 3, 5, 7, 8]

const REGION_LABEL: Record<SuitRegion, string> = {
  hood: 'Hood',
  body: 'Body',
  legs: 'Legs',
}

/** Where each region's thickness badge is drawn on the figure. */
const BADGE_POS: Record<SuitRegion, { x: number; y: number }[]> = {
  hood: [{ x: 100, y: 52 }],
  body: [{ x: 100, y: 148 }],
  legs: [
    { x: 83, y: 285 },
    { x: 117, y: 285 },
  ],
}

/** Map a thickness (mm) to a fill opacity so thicker neoprene reads as denser. */
function fillOpacity(mm: number): number {
  if (mm <= 0) return 0.05
  return 0.14 + (mm / 8) * 0.4
}

const fmtMm = (mm: number) => (mm <= 0 ? 'Bare' : `${mm} mm`)

/**
 * Interactive body figure for choosing wetsuit thickness per region. Tap a
 * body part (hood, body, arms or legs) to select it, then pick how thick the
 * neoprene is there. Each part can be a different thickness — or bare.
 */
export function BodySuitSelector({ value, onChange }: Props) {
  const [selected, setSelected] = useState<SuitRegion>('body')
  const titleId = useId()

  const mmOf = (region: SuitRegion) => value[region] ?? 0

  const setThickness = (region: SuitRegion, mm: number) => {
    onChange({ ...value, [region]: mm })
  }

  const regionAttrs = (region: SuitRegion) => ({
    className: `${styles.region} ${selected === region ? styles.regionSelected : ''}`,
    style: { fill: `rgba(0, 201, 255, ${fillOpacity(mmOf(region))})` },
    role: 'button' as const,
    tabIndex: 0,
    'aria-pressed': selected === region,
    'aria-label': `${REGION_LABEL[region]} — ${fmtMm(mmOf(region))}. Tap to set thickness.`,
    onClick: () => setSelected(region),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setSelected(region)
      }
    },
  })

  return (
    <div className={styles.wrap}>
      <p className={styles.hint} id={titleId}>
        Tap a body part, then set how thick your wetsuit is there. Leave a part
        bare if your suit doesn&apos;t cover it.
      </p>

      <div className={styles.layout}>
        <svg
          className={styles.figure}
          viewBox="0 0 200 400"
          role="group"
          aria-labelledby={titleId}
        >
          {/* Legs (behind torso so the hips overlap cleanly) */}
          <g {...regionAttrs('legs')}>
            <rect x={68} y={196} width={30} height={158} rx={14} />
            <rect x={102} y={196} width={30} height={158} rx={14} />
          </g>

          {/* Body — torso and arms together (a wetsuit jacket) */}
          <g {...regionAttrs('body')}>
            <rect x={36} y={92} width={22} height={98} rx={11} />
            <rect x={142} y={92} width={22} height={98} rx={11} />
            <rect x={62} y={88} width={76} height={116} rx={16} />
          </g>

          {/* Hood (head + neck) */}
          <g {...regionAttrs('hood')}>
            <ellipse cx={100} cy={46} rx={30} ry={34} />
            <rect x={86} y={74} width={28} height={18} rx={6} />
          </g>

          {/* Thickness badges */}
          {SUIT_REGIONS.flatMap(region =>
            BADGE_POS[region].map((pos, i) => (
              <text
                key={`${region}-${i}`}
                x={pos.x}
                y={pos.y}
                className={styles.badge}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {mmOf(region) > 0 ? mmOf(region) : '—'}
              </text>
            )),
          )}
        </svg>

        <div className={styles.controls}>
          <div className={styles.controlsLabel}>
            {REGION_LABEL[selected]} thickness
          </div>
          <div
            className={styles.choices}
            role="group"
            aria-label={`${REGION_LABEL[selected]} neoprene thickness`}
          >
            {THICKNESS_CHOICES.map(mm => (
              <button
                key={mm}
                type="button"
                className={`${styles.choice} ${mmOf(selected) === mm ? styles.choiceActive : ''}`}
                aria-pressed={mmOf(selected) === mm}
                onClick={() => setThickness(selected, mm)}
              >
                {mm <= 0 ? 'None' : `${mm}`}
              </button>
            ))}
          </div>
          <div className={styles.mmUnit}>millimetres of neoprene</div>

          <ul className={styles.summary} aria-label="Wetsuit summary">
            {SUIT_REGIONS.map(region => (
              <li
                key={region}
                className={`${styles.summaryRow} ${selected === region ? styles.summaryActive : ''}`}
              >
                <button type="button" onClick={() => setSelected(region)}>
                  <span>{REGION_LABEL[region]}</span>
                  <span className={mmOf(region) > 0 ? styles.summaryMm : styles.summaryBare}>
                    {fmtMm(mmOf(region))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
