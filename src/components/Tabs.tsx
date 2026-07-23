import styles from './Tabs.module.css'

export interface TabDef {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
  className?: string
}

// This is a pill *segmented control*, not an ARIA tabs widget: its call sites
// switch in-page content without associated tabpanels, so full tabs semantics
// (roving tabIndex, arrow-key navigation, aria-controls/id links to panels)
// would be a promise the markup doesn't keep. Each option is a plain toggle
// button that exposes its state through aria-pressed instead.
export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={className ? `${styles.tabs} ${className}` : styles.tabs} role="group">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={tab.id === active}
          className={tab.id === active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
