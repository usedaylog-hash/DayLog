import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '../types';
import { api } from '../api/client';
import { DayCard } from '../components/DayCard';
import { Toast } from '../components/Toast';
import styles from './HistoryPage.module.css';

export function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; session: Session } | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.getSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  function handleDelete(id: number) {
    // If there's already a pending delete, commit it immediately
    if (pendingDelete) {
      clearTimeout(deleteTimer.current);
      api.deleteSession(pendingDelete.id);
    }

    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    // Hide the card immediately
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setPendingDelete({ id, session });
  }

  const commitDelete = useCallback(() => {
    if (pendingDelete) {
      api.deleteSession(pendingDelete.id);
      setPendingDelete(null);
    }
  }, [pendingDelete]);

  function handleUndo() {
    clearTimeout(deleteTimer.current);
    if (pendingDelete) {
      // Re-insert the session back in the right position (sorted by clock_in desc)
      setSessions((prev) => {
        const restored = [...prev, pendingDelete.session];
        restored.sort((a, b) => new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime());
        return restored;
      });
      setPendingDelete(null);
    }
  }

  if (loading) {
    return <p className={styles.loading}>Loading...</p>;
  }

  if (sessions.length === 0 && !pendingDelete) {
    return <p className={styles.empty}>No sessions yet. Clock in on the Today page to get started.</p>;
  }

  return (
    <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
      <div className={styles.list}>
        {sessions.map((s) => (
          <DayCard key={s.id} session={s} onDelete={handleDelete} />
        ))}
      </div>
      {pendingDelete && (
        <Toast
          message="Session deleted"
          onUndo={handleUndo}
          onDismiss={commitDelete}
        />
      )}
    </div>
  );
}
