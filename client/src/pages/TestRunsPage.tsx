import { useState, useEffect } from 'react';
import type { TestRun } from '../types';
import { api } from '../api/client';
import { TestRunCard } from '../components/TestRunCard';
import styles from './TestRunsPage.module.css';

type ActiveTab = 'qa' | '187';

export function TestRunsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('qa');

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

  const filteredRuns = activeTab === 'qa'
    ? runs.filter((r) => r.environment === 'qa')
    : runs.filter((r) => r.environment !== 'qa');

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'qa' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          QA Server
        </button>
        <button
          className={`${styles.tab} ${activeTab === '187' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('187')}
        >
          187 Server
        </button>
      </div>
      <div className={styles.list}>
        {filteredRuns.map((run, i) => (
          <TestRunCard key={i} run={run} />
        ))}
        {filteredRuns.length === 0 && (
          <p className={styles.empty}>
            No {activeTab === 'qa' ? 'QA' : '187'} runs found.
          </p>
        )}
      </div>
    </div>
  );
}
