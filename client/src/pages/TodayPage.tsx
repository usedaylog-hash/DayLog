import { useState, useEffect, useCallback } from 'react';
import type { Session, Commit } from '../types';
import { api } from '../api/client';
import { ClockButton } from '../components/ClockButton';
import { CommitList } from '../components/CommitList';
import { DaySummary } from '../components/DaySummary';
import styles from './TodayPage.module.css';

const POLL_INTERVAL = 15_000;

export function TodayPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<Session | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const current = await api.getCurrentSession();
      setSession(current);
      setCommits(current?.commits || []);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Poll for commits while clocked in
  useEffect(() => {
    if (!session) return;

    const id = setInterval(async () => {
      try {
        const fresh = await api.getSessionCommits();
        setCommits(fresh);
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL);

    return () => clearInterval(id);
  }, [session]);

  async function handleClockIn() {
    setActionLoading(true);
    try {
      const newSession = await api.clockIn();
      setSession(newSession);
      setCommits([]);
      setLastCompleted(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClockOut() {
    setActionLoading(true);
    try {
      const completed = await api.clockOut();
      setLastCompleted(completed);
      setSession(null);
      setCommits([]);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComment(id: number, comment: string) {
    await api.updateCommitComment(id, comment);
    setCommits((prev) =>
      prev.map((c) => (c.id === id ? { ...c, comment: comment || null } : c))
    );
  }

  if (loading) {
    return <p className={styles.loading}>Loading...</p>;
  }

  const isClockedIn = session !== null;

  return (
    <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
      <ClockButton
        isClockedIn={isClockedIn}
        loading={actionLoading}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
      />

      {isClockedIn && (
        <p className={styles.status}>
          Clocked in since{' '}
          {new Date(session.clock_in).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}

      {isClockedIn && <CommitList commits={commits} onComment={handleComment} />}

      {lastCompleted?.summary && <DaySummary summary={lastCompleted.summary} />}
    </div>
  );
}
