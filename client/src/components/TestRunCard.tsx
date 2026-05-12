import type { TestRun } from '../types';
import styles from './TestRunCard.module.css';

interface Props {
  run: TestRun;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function passRate(run: TestRun): number {
  if (run.total === 0) return 0;
  return Math.round((run.passed / run.total) * 100);
}

export function TestRunCard({ run }: Props) {
  const rate = passRate(run);
  const rateClass = rate === 100 ? styles.green : rate >= 80 ? styles.yellow : styles.red;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.date}>{formatDate(run.timestamp)}</span>
        <span className={`${styles.badge} ${rateClass}`}>{rate}%</span>
      </div>

      <div className={styles.meta}>
        <span className={styles.env}>{run.environment}</span>
        <span className={styles.duration}>{formatDuration(run.duration)}</span>
      </div>

      <div className={styles.stats}>
        <span className={styles.passed}>{run.passed} passed</span>
        {run.failed > 0 && <span className={styles.failed}>{run.failed} failed</span>}
        {run.skipped > 0 && <span className={styles.skipped}>{run.skipped} skipped</span>}
        {run.flaky > 0 && <span className={styles.flaky}>{run.flaky} flaky</span>}
        <span className={styles.total}>{run.total} total</span>
      </div>

      {run.failedTests.length > 0 && (
        <div className={styles.failures}>
          <h4 className={styles.failuresHeading}>Failed tests</h4>
          <ul className={styles.failureList}>
            {run.failedTests.map((t, i) => (
              <li key={i}>
                <span className={styles.failedTestName}>{t.title}</span>
                <span className={styles.failedTestBrowser}>{t.projectName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
