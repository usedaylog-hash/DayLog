import type { Note } from '../types';
import styles from './NoteList.module.css';

interface Props {
  notes: Note[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NoteList({ notes }: Props) {
  if (notes.length === 0) {
    return <p className={styles.empty}>No notes yet. Add one above.</p>;
  }

  return (
    <ul className={styles.list}>
      {notes.map((note) => (
        <li key={note.id} className={styles.item}>
          <span className={styles.time}>{formatTime(note.timestamp)}</span>
          <span className={styles.content}>{note.content}</span>
        </li>
      ))}
    </ul>
  );
}
