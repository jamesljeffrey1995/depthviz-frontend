import { useState } from 'react'
import { IconChevronDown, IconChevronUp } from './icons'
import styles from './KelpVisibilityNote.module.css'

interface Props {
  /** Start expanded. Defaults to collapsed so it stays out of the way. */
  defaultOpen?: boolean
  /** Show the spearfishing-specific tip about open rock / sand patches. */
  showSpearfishingTip?: boolean
}

/** The drivers behind reduced clarity inside a kelp canopy. Kept as data so the
 *  copy stays consistent everywhere this note is rendered. */
const KELP_FACTORS: { title: string; detail: string }[] = [
  {
    title: 'Reduced flow & flushing',
    detail:
      'The canopy slows water movement, so the bed is not flushed by the cleaner open-water passing by.',
  },
  {
    title: 'Particulate trapping',
    detail:
      'Sheltered, slow-moving water lets suspended sediment and detritus settle out and accumulate among the fronds.',
  },
  {
    title: 'High biological load',
    detail:
      'Dense life on and around the kelp produces a steady stream of organic particles into the surrounding water.',
  },
  {
    title: 'Tannin & dissolved organics',
    detail:
      'Kelp fronds leach tannins and dissolved organic matter, tinting the water and cutting light penetration.',
  },
  {
    title: 'Depth transition',
    detail:
      'Dropping down through the canopy moves you into more turbid near-bottom water than the surface layer offshore.',
  },
]

/**
 * Explains the common "clear from shore / open water, but murky inside the kelp"
 * observation. A kelp bed is its own microenvironment and does not track
 * open-water conditions, so this is expected and normal — not a data or
 * forecast error. The forecast reflects open-coast conditions, which are valid;
 * a kelp bed is a local deviation that no satellite-derived parameter resolves
 * at that scale.
 */
export function KelpVisibilityNote({ defaultOpen = false, showSpearfishingTip = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={styles.note}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        Clear from shore but murky in the kelp?
        {open ? <IconChevronUp className={styles.toggleArrow} aria-hidden="true" /> : <IconChevronDown className={styles.toggleArrow} aria-hidden="true" />}
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.lead}>
            This is expected and normal — not a data error. A kelp bed is a distinct
            microenvironment and doesn&apos;t reflect open-water conditions, so the water
            inside the canopy can be noticeably murkier than the clear water just metres away.
          </p>

          <ul className={styles.factors}>
            {KELP_FACTORS.map(f => (
              <li key={f.title} className={styles.factor}>
                <span className={styles.factorTitle}>{f.title}</span>
                <span className={styles.factorDetail}>{f.detail}</span>
              </li>
            ))}
          </ul>

          {showSpearfishingTip && (
            <div className={styles.tip}>
              <span className={styles.tipLabel}>Spearfishing tip</span>
              <span className={styles.tipText}>
                Open rock face or sand patches within or next to the kelp will usually have
                better visibility than the kelp interior — work the edges and clearings.
              </span>
            </div>
          )}

          <p className={styles.footnote}>
            The forecast reflects open-coast conditions, which are valid. Kelp bed clarity is a
            local deviation that no satellite-derived parameter captures at that resolution.
          </p>
        </div>
      )}
    </div>
  )
}
