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
  const [lastHandoff, setLastHandoff] = useState<string | null>(null);
  const [showHandoffPanel, setShowHandoffPanel] = useState(false);
  const [handoffNote, setHandoffNote] = useState('');

  const loadSession = useCallback(async () => {
    try {
      const current = await api.getCurrentSession();
      setSession(current);
      setCommits(current?.commits || []);
      if (!current) {
        const { handoff } = await api.getLastHandoff();
        setLastHandoff(handoff);
      }
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

  function handleClockOutClick() {
    setShowHandoffPanel(true);
  }

  async function handleClockOutConfirm() {
    setActionLoading(true);
    try {
      const completed = await api.clockOut(handoffNote || undefined);
      setLastCompleted(completed);
      setLastHandoff(completed.handoff);
      setSession(null);
      setCommits([]);
      setShowHandoffPanel(false);
      setHandoffNote('');
    } finally {
      setActionLoading(false);
    }
  }

  function handleClockOutCancel() {
    setShowHandoffPanel(false);
    setHandoffNote('');
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
        onClockOut={handleClockOutClick}
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

      {showHandoffPanel && (
        <div className={styles.handoffPanel}>
          <h3 className={styles.handoffTitle}>Session Handoff</h3>
          <p className={styles.handoffDesc}>
            Commits are included automatically. Add any notes about what's still open:
          </p>
          <textarea
            className={styles.handoffTextarea}
            placeholder="What's still open?"
            value={handoffNote}
            onChange={(e) => setHandoffNote(e.target.value)}
            rows={4}
          />
          <div className={styles.handoffButtons}>
            <button
              className={styles.handoffCancel}
              onClick={handleClockOutCancel}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className={styles.handoffConfirm}
              onClick={handleClockOutConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? 'Clocking out...' : 'Clock Out'}
            </button>
          </div>
        </div>
      )}

      {isClockedIn && <CommitList commits={commits} onComment={handleComment} />}

      {lastCompleted?.summary && <DaySummary summary={lastCompleted.summary} />}

      {!isClockedIn && !showHandoffPanel && lastHandoff && (
        <div className={styles.previousHandoff}>
          <h3 className={styles.handoffTitle}>Previous Session</h3>
          <pre className={styles.handoffContent}>{lastHandoff}</pre>
        </div>
      )}
    </div>
  );
}
