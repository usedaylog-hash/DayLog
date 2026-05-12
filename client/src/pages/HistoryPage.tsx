import { useState, useEffect } from 'react';
import type { Session } from '../types';
import { api } from '../api/client';
import { DayCard } from '../components/DayCard';
import styles from './HistoryPage.module.css';

export function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p className={styles.loading}>Loading...</p>;
  }

  if (sessions.length === 0) {
    return <p className={styles.empty}>No sessions yet. Clock in on the Today page to get started.</p>;
  }

  return (
    <div className={styles.list}>
      {sessions.map((s) => (
        <DayCard key={s.id} session={s} />
      ))}
    </div>
  );
}
