import { useState, useEffect, useCallback } from 'react';
import type { Session, Commit, SessionBreak } from '../types';
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
  const [showPausePrompt, setShowPausePrompt] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

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

  const isPaused = session?.breaks?.some((b: SessionBreak) => !b.resume_time) ?? false;

  // Poll for commits while clocked in and not paused
  useEffect(() => {
    if (!session || isPaused) return;

    const id = setInterval(async () => {
      try {
        const fresh = await api.getSessionCommits();
        setCommits(fresh);
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL);

    return () => clearInterval(id);
  }, [session, isPaused]);

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

  function handlePauseClick() {
    setShowPausePrompt(true);
  }

  async function handlePauseConfirm() {
    setActionLoading(true);
    try {
      const updated = await api.pauseSession(pauseReason);
      setSession(updated);
      setCommits(updated.commits || []);
      setShowPausePrompt(false);
      setPauseReason('');
    } finally {
      setActionLoading(false);
    }
  }

  function handlePauseCancel() {
    setShowPausePrompt(false);
    setPauseReason('');
  }

  async function handleResume() {
    setActionLoading(true);
    try {
      const updated = await api.resumeSession();
      setSession(updated);
      setCommits(updated.commits || []);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteBreak(breakId: number) {
    try {
      await api.deleteBreak(breakId);
      setSession((prev) => prev ? {
        ...prev,
        breaks: prev.breaks?.filter((b) => b.id !== breakId),
      } : prev);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <p className={styles.loading}>Loading...</p>;
  }

  const isClockedIn = session !== null;

  return (
    <div className="container">
      <ClockButton
        isClockedIn={isClockedIn}
        loading={actionLoading}
        onClockIn={handleClockIn}
        onClockOut={handleClockOutClick}
      />

      {isClockedIn && !isPaused && (
        <p className={styles.status}>
          Clocked in since{' '}
          {new Date(session.clock_in).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}

      {isClockedIn && isPaused && (() => {
        const activeBreak = session.breaks?.find((b: SessionBreak) => !b.resume_time);
        return (
          <div className={styles.pausedStatus}>
            <p className={styles.pausedText}>
              Paused since{' '}
              {activeBreak ? new Date(activeBreak.pause_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }) : ''}
              {activeBreak?.reason ? ` — ${activeBreak.reason}` : ''}
            </p>
            <button
              className={styles.resumeBtn}
              onClick={handleResume}
              disabled={actionLoading}
            >
              {actionLoading ? 'Resuming...' : 'Resume'}
            </button>
          </div>
        );
      })()}

      {isClockedIn && !isPaused && !showHandoffPanel && !showPausePrompt && (
        <div className={styles.pauseActions}>
          <button
            className={styles.pauseBtn}
            onClick={handlePauseClick}
            disabled={actionLoading}
          >
            Pause
          </button>
        </div>
      )}

      {showPausePrompt && (
        <div className={styles.handoffPanel}>
          <h3 className={styles.handoffTitle}>Pause Session</h3>
          <p className={styles.handoffDesc}>What are you stepping away for?</p>
          <input
            type="text"
            className={styles.pauseInput}
            placeholder="Lunch, errand, appointment..."
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePauseConfirm(); }}
            autoFocus
          />
          <div className={styles.handoffButtons}>
            <button
              className={styles.handoffCancel}
              onClick={handlePauseCancel}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className={styles.pauseConfirmBtn}
              onClick={handlePauseConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? 'Pausing...' : 'Pause'}
            </button>
          </div>
        </div>
      )}

      {isClockedIn && session.breaks && session.breaks.filter((b: SessionBreak) => b.resume_time).length > 0 && (
        <div className={styles.breakHistory}>
          <h4 className={styles.breakHistoryTitle}>Breaks</h4>
          {session.breaks.filter((b: SessionBreak) => b.resume_time).map((b: SessionBreak) => (
            <div key={b.id} className={styles.breakItem}>
              <span className={styles.breakTime}>
                {new Date(b.pause_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(b.resume_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {b.reason && <span className={styles.breakReason}>{b.reason}</span>}
              <button
                className={styles.breakDeleteBtn}
                onClick={() => handleDeleteBreak(b.id)}
                title="Delete break"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
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
