import type { Session } from '../types';
import styles from './DayCard.module.css';

interface Props {
  session: Session;
  onDelete?: (id: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeRange(clockIn: string, clockOut: string | null): string {
  const start = new Date(clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!clockOut) return `${start} — ongoing`;
  const end = new Date(clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${start} — ${end}`;
}

function duration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return '';
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function DayCard({ session, onDelete }: Props) {
  function handleDelete() {
    if (window.confirm('Delete this session? This cannot be undone.')) {
      onDelete?.(session.id);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.date}>{formatDate(session.clock_in)}</span>
        <div className={styles.headerRight}>
          <span className={styles.duration}>{duration(session.clock_in, session.clock_out)}</span>
          {onDelete && (
            <button className={styles.deleteBtn} onClick={handleDelete} title="Delete session">
              &times;
            </button>
          )}
        </div>
      </div>
      <div className={styles.time}>{formatTimeRange(session.clock_in, session.clock_out)}</div>
      {session.summary && <p className={styles.summary}>{session.summary}</p>}
      {session.notes && session.notes.length > 0 && (
        <div className={styles.noteCount}>{session.notes.length} note{session.notes.length !== 1 ? 's' : ''}</div>
      )}
    </div>
  );
}
