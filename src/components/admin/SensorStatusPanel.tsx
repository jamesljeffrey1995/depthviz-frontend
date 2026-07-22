import type { AdminHealth } from '../../types'
import { StatusChip } from './StatusChip'
import styles from './AdminConsole.module.css'

/**
 * Sensor telemetry panel.
 *
 * The backend has no sensor tables yet, so this deliberately renders a
 * clearly-labelled TODO fallback rather than fake data. When the sensor
 * ingestion goes live it can populate ``health.sensors.sites`` and the panel
 * will start rendering real rows without further UI changes.
 */
export function SensorStatusPanel({ health }: { health: AdminHealth | null }) {
  const sensors = health?.sensors
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Sensor Status</span>
        {sensors && <StatusChip status={sensors.chip} />}
      </div>

      {!sensors || !sensors.configured ? (
        <div className={styles.sensorCallout}>
          <div className={styles.sensorTodo}>TODO — sensor ingestion pending</div>
          <div>
            No sensor tables are wired to the API yet. Once the Seaton Sluice
            deployment starts publishing to the ingest endpoint, this panel will
            show online/offline status, last reading, battery, and drift/anomaly
            state per sensor.
          </div>
          <div className={styles.panelSub}>
            Server report: {sensors?.note ?? 'sensors block not present'}
          </div>
        </div>
      ) : (
        <div>
          {sensors.sites.length === 0 ? (
            <div className={styles.emptyMsg}>No sensor sites reported.</div>
          ) : (
            sensors.sites.map(s => (
              <div className={styles.kv} key={s.name}>
                <span className={styles.kvKey}>{s.name}</span>
                <span className={styles.kvVal}>
                  <StatusChip status={s.chip} dot={false} />
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
