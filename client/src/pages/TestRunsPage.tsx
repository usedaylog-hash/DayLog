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

  return (
    <div className={styles.list}>
      {runs.map((run, i) => (
        <TestRunCard key={i} run={run} />
      ))}
    </div>
  );
}
