import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PortfolioData } from '../types';
import styles from './PortfolioPage.module.css';

type Tab = 'sessions' | 'bugs';

export function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('sessions');

  useEffect(() => {
    api.getPortfolio()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={styles.message}>Loading portfolio...</p>;
  if (error) return <p className={styles.message}>Error: {error}</p>;
  if (!data) return <p className={styles.message}>No data available.</p>;

  const { stats, sessions, bugs } = data;

  function severityClass(severity: string): string {
    const s = severity.toLowerCase();
    if (s === 'high' || s === 'critical') return styles.badgeHigh;
    if (s === 'low') return styles.badgeLow;
    if (s === 'info') return styles.badgeInfo;
    return styles.badgeMedium;
  }

  return (
    <div>
      <a
        href={api.getPortfolioPdfUrl()}
        className={styles.downloadBtn}
        download
      >
        Download PDF
      </a>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.totalHours}</div>
          <div className={styles.statLabel}>Total Time</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.sessionCount}</div>
          <div className={styles.statLabel}>Sessions</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.commitCount}</div>
          <div className={styles.statLabel}>Commits</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.bugsFound}</div>
          <div className={styles.statLabel}>Bugs Found</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.testRuns}</div>
          <div className={styles.statLabel}>Test Runs</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.passRate}%</div>
          <div className={styles.statLabel}>Pass Rate</div>
        </div>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === 'sessions' ? styles.tabActive : ''}`}
          onClick={() => setTab('sessions')}
        >
          Sessions ({sessions.length})
        </button>
        <button
          className={`${styles.tab} ${tab === 'bugs' ? styles.tabActive : ''}`}
          onClick={() => setTab('bugs')}
        >
          Bugs ({bugs.length})
        </button>
      </div>

      {tab === 'sessions' && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Duration</th>
                <th>Commits</th>
                <th>Notes</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>{s.duration}</td>
                  <td>{s.commitCount}</td>
                  <td>{s.noteCount}</td>
                  <td className={styles.activityCell}>{s.activity}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No sessions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bugs' && (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Feature Area</th>
                <th>Environment</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((bug) => (
                <tr key={bug.filename}>
                  <td>{bug.date}</td>
                  <td>{bug.title}</td>
                  <td><span className={`${styles.badge} ${severityClass(bug.severity)}`}>{bug.severity}</span></td>
                  <td>{bug.featureArea}</td>
                  <td>{bug.environment || '—'}</td>
                </tr>
              ))}
              {bugs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No bugs reported yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
