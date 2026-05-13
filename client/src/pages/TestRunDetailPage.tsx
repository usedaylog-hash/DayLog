import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { TestRunDetail } from '../types';
import { api } from '../api/client';
import styles from './TestRunDetailPage.module.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function passRate(run: TestRunDetail): number {
  if (run.total === 0) return 0;
  return Math.round((run.passed / run.total) * 100);
}

export function TestRunDetailPage() {
  const { filename } = useParams<{ filename: string }>();
  const [detail, setDetail] = useState<TestRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!filename) return;
    api.getTestRunDetail(filename)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filename]);

  function toggleTest(index: number) {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  if (loading) {
    return <p className={styles.message}>Loading run details...</p>;
  }

  if (error || !detail) {
    return <p className={styles.message}>Failed to load run details: {error}</p>;
  }

  const rate = passRate(detail);
  const rateClass = rate === 100 ? styles.green : rate >= 80 ? styles.yellow : styles.red;

  return (
    <div className={styles.container}>
      <Link to="/test-runs" className={styles.backLink}>
        &larr; Back to Test Runs
      </Link>

      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <span className={styles.date}>{formatDate(detail.timestamp)}</span>
          <span className={`${styles.badge} ${rateClass}`}>{rate}%</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.env}>{detail.environment}</span>
          <span>{formatTime(detail.timestamp)}</span>
          <span>{detail.duration}</span>
        </div>
        <div className={styles.stats}>
          <span className={styles.passed}>{detail.passed} passed</span>
          {detail.failed > 0 && <span className={styles.failed}>{detail.failed} failed</span>}
          {detail.skipped > 0 && <span className={styles.skipped}>{detail.skipped} skipped</span>}
          <span className={styles.total}>{detail.total} total</span>
        </div>
      </div>

      {detail.failedTestDetails.length > 0 && (
        <div className={styles.section}>
          <h3 className={`${styles.sectionHeading} ${styles.failedHeading}`}>
            Failed Tests ({detail.failedTestDetails.length})
          </h3>
          {detail.failedTestDetails.map((test, i) => {
            const isOpen = expandedTests.has(i);
            return (
              <div key={i} className={styles.failedCard}>
                <button
                  className={styles.failedToggle}
                  onClick={() => toggleTest(i)}
                >
                  <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                    &#9654;
                  </span>
                  <span className={styles.testName}>{test.name}</span>
                </button>
                {isOpen && (
                  <div className={styles.errorBlock}>
                    <pre className={styles.errorPre}>{test.error}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {detail.skippedTests.length > 0 && (
        <div className={styles.section}>
          <h3 className={`${styles.sectionHeading} ${styles.skippedHeading}`}>
            Skipped Tests ({detail.skippedTests.length})
          </h3>
          <ul className={styles.skippedList}>
            {detail.skippedTests.map((test, i) => (
              <li key={i}>{test}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
