import { Link } from 'react-router-dom';
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
  });
}

function passRate(run: TestRun): number {
  if (run.total === 0) return 0;
  return Math.round((run.passed / run.total) * 100);
}

export function TestRunCard({ run }: Props) {
  const rate = passRate(run);
  const rateClass = rate === 100 ? styles.green : rate >= 80 ? styles.yellow : styles.red;

  return (
    <Link to={`/test-runs/${run.filename}`} className={styles.cardLink}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.date}>{formatDate(run.timestamp)}</span>
          <span className={`${styles.badge} ${rateClass}`}>{rate}%</span>
        </div>

        <div className={styles.meta}>
          <span className={styles.env}>{run.environment}</span>
          <span className={styles.duration}>{run.duration}</span>
        </div>

        <div className={styles.stats}>
          <span className={styles.passed}>{run.passed} passed</span>
          {run.failed > 0 && <span className={styles.failed}>{run.failed} failed</span>}
          {run.skipped > 0 && <span className={styles.skipped}>{run.skipped} skipped</span>}
          <span className={styles.total}>{run.total} total</span>
        </div>

        {run.failedTests.length > 0 && (
          <div className={styles.failures}>
            <h4 className={styles.failuresHeading}>Failed tests</h4>
            <ul className={styles.failureList}>
              {run.failedTests.map((test, i) => (
                <li key={i}>{test}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Link>
  );
}
