import { useState, useEffect } from 'react'
import styles from './LegalPage.module.css'
import clStyles from './ChangelogPage.module.css'

interface Props {
  onBack: () => void
}

interface ChangelogEntry {
  version: string
  date: string
  sections: { heading: string; items: string[] }[]
}

function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  let currentSection: { heading: string; items: string[] } | null = null

  for (const line of raw.split('\n')) {
    // Match both `#` minor/major and `##` patch headings. The version label is
    // usually a markdown link like `[1.5.0](https://…/compare/v1.4.1...v1.5.0)`,
    // so capture everything up to the trailing `(date)` and then strip the link
    // wrapper down to its display text — otherwise the full compare URL renders
    // in the header and overflows the card.
    const versionMatch = line.match(/^#+\s+(.+?)\s+\((\d{4}-\d{2}-\d{2})\)/)
    if (versionMatch) {
      if (currentSection && current) current.sections.push(currentSection)
      if (current) entries.push(current)
      const linkMatch = versionMatch[1].match(/^\[([^\]]+)\]\([^)]+\)$/)
      const version = linkMatch ? linkMatch[1] : versionMatch[1]
      current = { version, date: versionMatch[2], sections: [] }
      currentSection = null
      continue
    }

    const sectionMatch = line.match(/^###\s+(.+)/)
    if (sectionMatch && current) {
      if (currentSection) current.sections.push(currentSection)
      currentSection = { heading: sectionMatch[1], items: [] }
      continue
    }

    const itemMatch = line.match(/^\*\s+(.+)/)
    if (itemMatch && currentSection) {
      // Strip markdown commit links like ([abc1234](url)) at the end, then drop
      // leftover inline markdown (** ** emphasis, ` ` code) so the bare text reads
      // cleanly instead of showing raw markers.
      const text = itemMatch[1]
        .replace(/\s*\(\[[\da-f]+\]\([^)]+\)\)/g, '')
        .replace(/\s*\[#[\w-]+\]\([^)]+\)/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
      if (text) currentSection.items.push(text)
    }
  }

  if (currentSection && current) current.sections.push(currentSection)
  if (current) entries.push(current)
  return entries
}

export function ChangelogPage({ onBack }: Props) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/CHANGELOG.md')
      .then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.text()
      })
      .then(text => setEntries(parseChangelog(text)))
      .catch(() => setError(true))
  }, [])

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={onBack}>&larr; Back</button>
      <div className={styles.title}>Changelog</div>
      <div className={styles.updated}>Auto-generated from semantic versioning on every release</div>

      {error && (
        <div className={styles.section}>
          <p>Changelog not available. It is generated at build time and will appear on the next deployment.</p>
        </div>
      )}

      {entries.map(entry => (
        <div key={entry.version} className={clStyles.entry}>
          <div className={clStyles.versionHeader}>
            <span className={clStyles.version}>v{entry.version}</span>
            <span className={clStyles.date}>{entry.date}</span>
          </div>
          {entry.sections.map(section => (
            <div key={section.heading} className={styles.section}>
              <h3>{section.heading}</h3>
              <ul>
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
