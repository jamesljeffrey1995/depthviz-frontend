import type { AdminHealth } from '../../types'
import { StatusChip } from './StatusChip'
import { formatRelative, formatDateTime, formatNum } from './formatters'
import styles from './AdminConsole.module.css'

/**
 * Top-of-console system health strip. One glance answers "is DepthViz healthy?"
 *
 * Layout intent: services on the left, data-stream freshness in the middle,
 * model + coverage on the right — same order as the operator reads them when
 * something breaks (upstream → data → model).
 */
export function HealthSummaryCard({ health, loading }: { health: AdminHealth | null; loading: boolean }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>System Health</span>
        {health && <StatusChip status={health.pipeline.status} />}
      </div>
      {loading && !health && <div className={styles.loading}>Loading health…</div>}
      {health && (
        <div className={styles.healthGrid}>
          {/* Upstream services */}
          {Object.entries(health.services).map(([name, probe]) => (
            <div className={styles.healthCard} key={name}>
              <div className={styles.healthCardLbl}>{name.replace('_', ' ')}</div>
              <div className={styles.healthCardVal}>
                <StatusChip status={probe.chip} />
              </div>
              <div className={styles.healthCardMeta}>
                probed {formatRelative(probe.checked_at)}
              </div>
            </div>
          ))}

          {/* Data streams */}
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Weather / Marine</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.data_streams.weather.chip} />
            </div>
            <div className={styles.healthCardMeta}>
              last pull {formatRelative(health.data_streams.weather.last_fetched)}
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>CMEMS optics</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.data_streams.cmems.chip} />
            </div>
            <div className={styles.healthCardMeta}>
              last pull {formatRelative(health.data_streams.cmems.last_fetched)}
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Tides</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.data_streams.tides.chip} />
            </div>
            <div className={styles.healthCardMeta}>ephemeris (live)</div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>User reports</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.data_streams.reports.chip} />
            </div>
            <div className={styles.healthCardMeta}>
              last report {formatRelative(health.data_streams.reports.last_received)}
            </div>
          </div>

          {/* Sensors — surface the missing capability rather than fake it. */}
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Sensors</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.sensors.chip} />
            </div>
            <div className={styles.healthCardMeta}>
              {health.sensors.configured
                ? `${health.sensors.sites.length} deployed`
                : 'not yet wired up'}
            </div>
          </div>

          {/* Model + coverage */}
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Model</div>
            <div className={styles.healthCardVal}>
              <StatusChip status={health.model.confidence_chip} />
            </div>
            <div className={styles.healthCardMeta}>
              {health.model.version} · retrained {formatRelative(health.model.last_retrain)}
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Metrics</div>
            <div className={styles.healthCardVal}>
              R² {formatNum(health.model.r2, 2)} · MAE {formatNum(health.model.mae, 2, 'm')}
            </div>
            <div className={styles.healthCardMeta}>
              RMSE {formatNum(health.model.rmse, 2, 'm')}
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Active sites</div>
            <div className={styles.healthCardVal}>{health.coverage.active_sites}</div>
            <div className={styles.healthCardMeta}>
              {health.coverage.active_reports} active reports
            </div>
          </div>
          <div className={styles.healthCard}>
            <div className={styles.healthCardLbl}>Pipeline probe</div>
            <div className={styles.healthCardVal}>
              {formatDateTime(health.pipeline.checked_at)}
            </div>
            <div className={styles.healthCardMeta}>next auto-probe ~6h</div>
          </div>
        </div>
      )}
    </div>
  )
}
