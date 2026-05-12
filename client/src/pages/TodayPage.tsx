import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types';
import { api } from '../api/client';
import { ClockButton } from '../components/ClockButton';
import { NoteEntry } from '../components/NoteEntry';
import { NoteList } from '../components/NoteList';
import { DaySummary } from '../components/DaySummary';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<Session | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const current = await api.getCurrentSession();
      setSession(current);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function handleClockIn() {
    setActionLoading(true);
    try {
      const newSession = await api.clockIn();
      setSession(newSession);
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
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddNote(content: string) {
    const note = await api.addNote(content);
    setSession((prev) =>
      prev ? { ...prev, notes: [...(prev.notes || []), note] } : prev
    );
  }

  if (loading) {
    return <p className={styles.loading}>Loading...</p>;
  }

  const isClockedIn = session !== null;

  return (
    <div>
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

      <NoteEntry onSubmit={handleAddNote} disabled={!isClockedIn} />

      {isClockedIn && session.notes && <NoteList notes={session.notes} />}

      {lastCompleted?.summary && <DaySummary summary={lastCompleted.summary} />}
    </div>
  );
}
