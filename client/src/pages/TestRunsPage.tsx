import { useState, useEffect } from 'react';
import type { TestRun } from '../types';
import { api } from '../api/client';
import { TestRunCard } from '../components/TestRunCard';
import styles from './TestRunsPage.module.css';

export function TestRunsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTestRuns()
      .then(setRuns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className={styles.message}>Loading test runs...</p>;
  }

  if (error) {
    return <p className={styles.message}>Failed to load test runs: {error}</p>;
  }

  if (runs.length === 0) {
    return <p className={styles.message}>No test runs found.</p>;
  }

  const qaRuns = runs.filter((r) => r.environment === 'qa');
  const serverRuns = runs.filter((r) => r.environment !== 'qa');

  return (
    <div className={styles.columns}>
      <div className={styles.column}>
        <h2 className={styles.columnTitle}>QA Server</h2>
        <div className={styles.list}>
          {qaRuns.map((run, i) => (
            <TestRunCard key={i} run={run} />
          ))}
          {qaRuns.length === 0 && <p className={styles.empty}>No QA runs found.</p>}
        </div>
      </div>
      <div className={styles.column}>
        <h2 className={styles.columnTitle}>187 Server</h2>
        <div className={styles.list}>
          {serverRuns.map((run, i) => (
            <TestRunCard key={i} run={run} />
          ))}
          {serverRuns.length === 0 && <p className={styles.empty}>No 187 runs found.</p>}
        </div>
      </div>
    </div>
  );
}
